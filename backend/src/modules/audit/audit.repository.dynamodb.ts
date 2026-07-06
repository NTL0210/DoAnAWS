import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import { text } from "../../infrastructure/aws/dynamodb-utils.js";
import { decodeNextToken, encodeNextToken } from "../../shared/pagination/token.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { AuditRepository } from "./audit.repository.js";
import type { AuditAction, AuditEvent } from "./audit.types.js";

const entityType = "AUDIT";

function pk(workspaceId: string): string {
  return `WORKSPACE#${workspaceId}`;
}

function sk(eventId: string): string {
  return `AUDIT#${eventId}`;
}

function toItem(event: AuditEvent): Record<string, unknown> {
  return {
    PK: pk(event.workspaceId),
    SK: sk(event.id),
    entityType,
    GSI1PK: `WORKSPACE#${event.workspaceId}#AUDIT`,
    GSI1SK: `${event.createdAt}#${event.id}`,
    ...event,
  };
}

function fromItem(item: Record<string, unknown>): AuditEvent {
  return {
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    action: text(item.action) as AuditAction,
    performedBy: text(item.performedBy),
    targetType: text(item.targetType),
    targetId: text(item.targetId),
    details: isRecord(item.details) ? item.details : undefined,
    createdAt: text(item.createdAt),
  };
}

export class DynamoAuditRepository implements AuditRepository {
  async create(event: AuditEvent): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Item: toItem(event),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<AuditEvent>> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${params.workspaceId}#AUDIT`,
        },
        ScanIndexForward: false,
        Limit: params.limit,
        ExclusiveStartKey: decodeNextToken(params.nextToken),
      }),
    );

    return {
      items: (result.Items ?? []).map(fromItem),
      nextToken: encodeNextToken(result.LastEvaluatedKey),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
