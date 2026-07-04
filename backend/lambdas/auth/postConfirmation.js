/**
 * PostConfirmation Lambda Trigger — Auto-create DynamoDB user
 *
 * Khi Cognito xác nhận user thành công, Lambda này tự động
 * tạo user record trong DynamoDB để các API khác có thể truy vấn.
 *
 * Triển khai: Cognito User Pool → Triggers → Post confirmation
 *
 * @module lambdas/auth/postConfirmation
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const { AWS_REGION, DYNAMODB_TABLE } = process.env;

const client = new DynamoDBClient({ region: AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Cognito PostConfirmation handler.
 *
 * @param {Object} event - Cognito User Pool PostConfirmation event
 * @returns {Promise<Object>} The event, unchanged
 */
export async function handler(event) {
  const { userName, userAttributes } = event.request;

  console.log(`[PostConfirmation] Creating DynamoDB user: ${userName}`);

  const userId = userAttributes.sub;
  const email = userAttributes.email;
  const name = userAttributes.name || userAttributes.preferred_username || email?.split('@')[0] || 'User';
  const now = new Date().toISOString();

  if (!userId || !email) {
    console.error('[PostConfirmation] Missing userId or email in Cognito attributes');
    return event; // Don't block Cognito flow
  }

  const record = {
    PK: `USER#${userId}`,
    SK: `PROFILE#${userId}`,
    id: userId,
    name,
    email: email.toLowerCase(),
    avatar: userAttributes.picture || null,
    phone: userAttributes.phone_number || '',
    avatarHistory: [],
    role: 'EMPLOYEE',
    departmentId: null,
    GSI1PK: `EMAIL#${email.toLowerCase()}`,
    GSI1SK: `USER#${userId}`,
    GSI2PK: 'ROLE#EMPLOYEE',
    GSI2SK: `PROFILE#${userId}`,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const tableName = DYNAMODB_TABLE || 'ai-meeting-platform';
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: record,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    console.log(`[PostConfirmation] Created DynamoDB user: ${userId}`);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log(`[PostConfirmation] User already exists in DynamoDB: ${userId}`);
    } else {
      console.error('[PostConfirmation] Error creating user:', err);
    }
  }

  return event;
}

export default { handler };
