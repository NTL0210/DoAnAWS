/**
 * DynamoDB Client wrapper — single-table access layer
 *
 * Provides low-level CRUD + query operations using the single-table
 * design defined in entityTypes.js.
 *
 * In production, uses AWS DynamoDB.
 * In development, can fall back to a mock (DynamoDB Local or in-memory).
 *
 * @module dynamodb/client
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const { ENVIRONMENT, TABLE_NAME, AWS_REGION, DYNAMODB_ENDPOINT } = process.env;

/** @type {DynamoDBDocumentClient|null} */
let docClient = null;

/**
 * Get or initialize the DynamoDB document client.
 * Supports local dev via DYNAMODB_ENDPOINT env var.
 *
 * @returns {DynamoDBDocumentClient}
 */
function getClient() {
  if (docClient) return docClient;

  const clientConfig = {
    region: AWS_REGION || 'ap-southeast-1',
    ...(DYNAMODB_ENDPOINT ? { endpoint: DYNAMODB_ENDPOINT } : {}),
  };

  // In non-prod environments, disable SSL for local DynamoDB
  if (ENVIRONMENT !== 'prod' && DYNAMODB_ENDPOINT) {
    clientConfig.tls = false;
    clientConfig.forcePathStyle = true;
  }

  const client = new DynamoDBClient(clientConfig);
  docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });

  return docClient;
}

/**
 * Get the configured table name.
 * @returns {string}
 */
export function getTableName() {
  return TABLE_NAME || 'ai-meeting-workforce-dev';
}

// ─── Core Operations ──────────────────────────────────

/**
 * Get an item by primary key.
 * @param {Object} key - { PK: string, SK: string }
 * @param {Object} [options]
 * @param {boolean} [options.consistentRead]
 * @returns {Promise<Object|null>}
 */
export async function getItem(key, options = {}) {
  const cmd = new GetCommand({
    TableName: getTableName(),
    Key: key,
    ConsistentRead: options.consistentRead ?? false,
  });
  const result = await getClient().send(cmd);
  return result.Item || null;
}

/**
 * Put an item (create or replace).
 * @param {Object} item - Full item to put
 * @returns {Promise<void>}
 */
export async function putItem(item) {
  const cmd = new PutCommand({
    TableName: getTableName(),
    Item: {
      ...item,
      expiresAt: item.expiresAt ?? undefined,
    },
  });
  await getClient().send(cmd);
}

/**
 * Update an item by key with partial attributes.
 * @param {Object} key - { PK: string, SK: string }
 * @param {Object} updates - { field: value, ... }
 * @param {Object} [options]
 * @param {number} [options.expectedVersion] - Optimistic locking version
 * @param {string[]} [options.nullFields] - Fields to set to NULL
 * @returns {Promise<Object>} Updated item
 */
export async function updateItem(key, updates, options = {}) {
  const exprParts = [];
  const exprAttrValues = {};
  const exprAttrNames = {};
  let conditionExpr = '';

  for (const [field, value] of Object.entries(updates)) {
    if (value !== undefined) {
      exprParts.push(`#${field} = :${field}`);
      exprAttrNames[`#${field}`] = field;
      exprAttrValues[`:${field}`] = value;
    }
  }

  // Handle null fields
  if (options.nullFields) {
    for (const field of options.nullFields) {
      exprParts.push(`#${field} = :${field}_null`);
      exprAttrNames[`#${field}`] = field;
      exprAttrValues[`:${field}_null`] = null;
    }
  }

  // Add optimistic locking
  if (options.expectedVersion !== undefined) {
    conditionExpr = 'attribute_exists(PK) AND #version = :expectedVersion';
    exprAttrNames['#version'] = 'version';
    exprAttrValues[':expectedVersion'] = options.expectedVersion;
    exprParts.push('#version = :newVersion');
    exprAttrValues[':newVersion'] = (options.expectedVersion || 0) + 1;
  }

  if (exprParts.length === 0) return await getItem(key);

  const cmd = new UpdateCommand({
    TableName: getTableName(),
    Key: key,
    UpdateExpression: `SET ${exprParts.join(', ')}`,
    ExpressionAttributeNames: exprAttrNames,
    ExpressionAttributeValues: exprAttrValues,
    ConditionExpression: conditionExpr || undefined,
    ReturnValues: 'ALL_NEW',
  });

  const result = await getClient().send(cmd);
  return result.Attributes || null;
}

/**
 * Delete an item by key.
 * @param {Object} key - { PK: string, SK: string }
 * @returns {Promise<void>}
 */
export async function deleteItem(key) {
  const cmd = new DeleteCommand({
    TableName: getTableName(),
    Key: key,
  });
  await getClient().send(cmd);
}

/**
 * Query items with a key condition.
 * @param {Object} params
 * @param {string} params.KeyConditionExpression
 * @param {Object} params.ExpressionAttributeValues
 * @param {Object} [params.ExpressionAttributeNames]
 * @param {string} [params.IndexName] - GSI name
 * @param {boolean} [params.ScanIndexForward] - true = ascending
 * @param {number} [params.Limit]
 * @param {Object} [params.ExclusiveStartKey]
 * @param {string} [params.FilterExpression]
 * @returns {Promise<{items: Object[], lastEvaluatedKey: Object|null}>}
 */
export async function queryItems(params) {
  const cmd = new QueryCommand({
    TableName: getTableName(),
    KeyConditionExpression: params.KeyConditionExpression,
    ExpressionAttributeValues: params.ExpressionAttributeValues,
    ExpressionAttributeNames: params.ExpressionAttributeNames,
    IndexName: params.IndexName,
    ScanIndexForward: params.ScanIndexForward ?? false,
    Limit: params.Limit || 100,
    ExclusiveStartKey: params.ExclusiveStartKey,
    FilterExpression: params.FilterExpression,
  });
  const result = await getClient().send(cmd);
  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey || null,
  };
}

/**
 * Batch get items by their keys.
 * @param {Object[]} keys - Array of { PK, SK }
 * @returns {Promise<Object[]>}
 */
export async function batchGetItems(keys) {
  if (keys.length === 0) return [];
  const cmd = new BatchGetCommand({
    RequestItems: {
      [getTableName()]: {
        Keys: keys,
      },
    },
  });
  const result = await getClient().send(cmd);
  return result.Responses?.[getTableName()] || [];
}

/**
 * Batch write items (put or delete).
 * @param {Object[]} items - Array of { PutRequest: { Item } } or { DeleteRequest: { Key } }
 * @returns {Promise<void>}
 */
export async function batchWriteItems(items) {
  if (items.length === 0) return;
  // DynamoDB batch write max 25 items per request
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    const cmd = new BatchWriteCommand({
      RequestItems: {
        [getTableName()]: batch,
      },
    });
    await getClient().send(cmd);
  }
}

/**
 * Execute a transactional write.
 * @param {Object[]} items - Array of transact write items
 * @returns {Promise<void>}
 */
export async function transactWriteItems(items) {
  const cmd = new TransactWriteCommand({
    TransactItems: items,
  });
  await getClient().send(cmd);
}

export default {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  queryItems,
  batchGetItems,
  batchWriteItems,
  transactWriteItems,
  getTableName,
};
