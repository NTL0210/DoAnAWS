import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import { env } from "../../config/env.js";
import {
  text,
  textArray,
  num,
  nullableText,
  isConditionalFailure,
} from "../../infrastructure/aws/dynamodb-utils.js";
import { ConflictError } from "../../shared/errors/app-error.js";
import { decodeNextToken, encodeNextToken } from "../../shared/pagination/token.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { MeetingRepository } from "./meeting.repository.js";
import type { Meeting, SuggestedTask } from "./meeting.types.js";

const entityType = "MEETING";

function pk(workspaceId: string): string {
  return `WORKSPACE#${workspaceId}`;
}

function sk(meetingId: string): string {
  return `MEETING#${meetingId}`;
}

function toItem(meeting: Meeting): Record<string, unknown> {
  return {
    PK: pk(meeting.workspaceId),
    SK: sk(meeting.id),
    entityType,
    GSI1PK: `WORKSPACE#${meeting.workspaceId}#MEETINGS`,
    GSI1SK: `${meeting.createdAt}#${meeting.id}`,
    ...meeting,
  };
}

function fromItem(item: Record<string, unknown>): Meeting {
  return {
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    teamId: nullableText(item.teamId),
    title: text(item.title),
    status: text(item.status, "UPLOADED") as Meeting["status"],
    transcriptText: text(item.transcriptText),
    summary: text(item.summary),
    keyDecisions: textArray(item.keyDecisions),
    risks: textArray(item.risks),
    actionItems: textArray(item.actionItems),
    suggestedTasks: Array.isArray(item.suggestedTasks)
      ? (item.suggestedTasks as SuggestedTask[])
      : [],
    generatedTaskIds: textArray(item.generatedTaskIds),
    storageRef: nullableText(item.storageRef),
    expiresAt: typeof item.expiresAt === "number" ? item.expiresAt : undefined,
    version: num(item.version, 1),
    createdBy: nullableText(item.createdBy),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  };
}

export class DynamoMeetingRepository implements MeetingRepository {
  async getById(params: {
    workspaceId: string;
    meetingId: string;
  }): Promise<Meeting | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(params.workspaceId), SK: sk(params.meetingId) },
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
          ":pk": `WORKSPACE#${params.workspaceId}#MEETINGS`,
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

  async create(meeting: Meeting): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(meeting),
          ConditionExpression: "attribute_not_exists(PK)",
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
          ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
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
      SK: sk(id),
    }));
    const items: Meeting[] = [];

    for (let attempt = 0; keys.length > 0 && attempt < 5; attempt++) {
      const result = await ddb.send(
        new BatchGetCommand({
          RequestItems: {
            [env.DYNAMODB_TABLE_MAIN]: { Keys: keys },
          },
        }),
      );
      items.push(
        ...((result.Responses?.[env.DYNAMODB_TABLE_MAIN] ?? []).map(fromItem)),
      );
      keys =
        result.UnprocessedKeys?.[env.DYNAMODB_TABLE_MAIN]?.Keys?.map((key) => ({
          PK: String(key.PK),
          SK: String(key.SK),
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
        ExpressionAttributeValues: { ":expiresAt": params.expiresAt },
      }),
    );
  }
}
