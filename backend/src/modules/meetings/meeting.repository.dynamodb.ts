import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import { env } from "../../config/env.js";
import { ConflictError } from "../../shared/errors/app-error.js";
import {
  decodeNextToken,
  encodeNextToken
} from "../../shared/pagination/token.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { MeetingRepository } from "./meeting.repository.js";
import type { Meeting } from "./meeting.types.js";

const entityType = "MEETING";

function pk(workspaceId: string): string {
  return `WORKSPACE#${workspaceId}`;
}

function sk(meetingId: string): string {
  return `MEETING#${meetingId}`;
}

type MeetingItem = Meeting & {
  PK: string;
  SK: string;
  entityType: typeof entityType;
  GSI1PK: string;
  GSI1SK: string;
};

function toItem(meeting: Meeting): MeetingItem {
  return {
    PK: pk(meeting.workspaceId),
    SK: sk(meeting.id),
    entityType,
    GSI1PK: `WORKSPACE#${meeting.workspaceId}#MEETINGS`,
    GSI1SK: `${meeting.createdAt}#${meeting.id}`,
    ...meeting
  };
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function fromItem(item: Record<string, unknown>): Meeting {
  return {
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    teamId: item.teamId ? text(item.teamId) : null,
    title: text(item.title),
    status: item.status as Meeting["status"],
    transcriptText: text(item.transcriptText),
    summary: text(item.summary),
    keyDecisions: Array.isArray(item.keyDecisions) ? item.keyDecisions.map(String) : [],
    risks: Array.isArray(item.risks) ? item.risks.map(String) : [],
    actionItems: Array.isArray(item.actionItems) ? item.actionItems.map(String) : [],
    suggestedTasks: Array.isArray(item.suggestedTasks)
      ? (item.suggestedTasks as Meeting["suggestedTasks"])
      : [],
    generatedTaskIds: Array.isArray(item.generatedTaskIds)
      ? item.generatedTaskIds.map(String)
      : [],
    storageRef: item.storageRef ? text(item.storageRef) : null,
    expiresAt: typeof item.expiresAt === "number" ? item.expiresAt : undefined,
    version: Number(item.version),
    createdBy: item.createdBy ? text(item.createdBy) : null,
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt)
  };
}

function isConditionalFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ConditionalCheckFailedException"
  );
}

export class DynamoMeetingRepository implements MeetingRepository {
  async getById(params: {
    workspaceId: string;
    meetingId: string;
  }): Promise<Meeting | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(params.workspaceId), SK: sk(params.meetingId) }
      }),
    );
    return result.Item ? fromItem(result.Item) : null;
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<Meeting>> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${params.workspaceId}#MEETINGS`
        },
        ScanIndexForward: false,
        Limit: params.limit,
        ExclusiveStartKey: decodeNextToken(params.nextToken)
      }),
    );
    return {
      items: (result.Items ?? []).map(fromItem),
      nextToken: encodeNextToken(result.LastEvaluatedKey)
    };
  }

  async create(meeting: Meeting): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(meeting),
          ConditionExpression: "attribute_not_exists(PK)"
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) {
        throw new ConflictError("Meeting already exists");
      }
      throw error;
    }
  }

  async update(meeting: Meeting, expectedVersion: number): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(meeting),
          ConditionExpression: "#version = :expectedVersion",
          ExpressionAttributeNames: { "#version": "version" },
          ExpressionAttributeValues: { ":expectedVersion": expectedVersion }
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) {
        throw new ConflictError("Meeting version conflict");
      }
      throw error;
    }
  }

  async batchGetByIds(params: {
    workspaceId: string;
    meetingIds: string[];
  }): Promise<Meeting[]> {
    let keys = params.meetingIds.map((id) => ({
      PK: pk(params.workspaceId),
      SK: sk(id)
    }));
    const items: Meeting[] = [];

    for (let attempt = 0; keys.length > 0 && attempt < 5; attempt += 1) {
      const result = await ddb.send(
        new BatchGetCommand({
          RequestItems: {
            [env.DYNAMODB_TABLE_MAIN]: { Keys: keys }
          }
        }),
      );
      items.push(
        ...((result.Responses?.[env.DYNAMODB_TABLE_MAIN] ?? []).map(fromItem)),
      );
      keys =
        result.UnprocessedKeys?.[env.DYNAMODB_TABLE_MAIN]?.Keys?.map((key) => ({
          PK: String(key.PK),
          SK: String(key.SK)
        })) ?? [];
    }
    return items;
  }

  async markExpired(params: {
    workspaceId: string;
    meetingId: string;
    expiresAt: number;
  }): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(params.workspaceId), SK: sk(params.meetingId) },
        UpdateExpression: "SET expiresAt = :expiresAt",
        ExpressionAttributeValues: { ":expiresAt": params.expiresAt }
      }),
    );
  }
}
