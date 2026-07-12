import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import { nullableText, num, text } from "../../infrastructure/aws/dynamodb-utils.js";
import { decodeNextToken, encodeNextToken } from "../../shared/pagination/token.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { VoiceRecordingRepository } from "./voice-recording.repository.js";
import type { VoiceRecording, VoiceRecordingStatus } from "./voice-recording.types.js";

const entityType = "VOICE_RECORDING";

function pk(recordingId: string): string {
  return `VOICE_RECORDING#${recordingId}`;
}

function sk(recordingId: string): string {
  return `META#${recordingId}`;
}

function channelIndex(workspaceId: string, channelId: string): string {
  return `WORKSPACE#${workspaceId}#VOICE#${channelId}`;
}

function toItem(recording: VoiceRecording): Record<string, unknown> {
  return {
    PK: pk(recording.id),
    SK: sk(recording.id),
    entityType,
    GSI1PK: channelIndex(recording.workspaceId, recording.channelId),
    GSI1SK: `${recording.createdAt}#${recording.id}`,
    ...recording,
  };
}

function fromItem(item: Record<string, unknown>): VoiceRecording {
  return {
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    channelId: text(item.channelId),
    title: text(item.title),
    fileName: text(item.fileName),
    mimeType: text(item.mimeType, "audio/webm"),
    sizeBytes: num(item.sizeBytes, 0),
    durationSeconds: num(item.durationSeconds, 0),
    storageKey: nullableText(item.storageKey),
    status: text(item.status, "CREATED") as VoiceRecordingStatus,
    aiStatus: text(item.aiStatus, "NOT_SENT") as VoiceRecording["aiStatus"],
    meetingId: nullableText(item.meetingId),
    createdBy: text(item.createdBy),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
    deletedAt: nullableText(item.deletedAt) ?? undefined,
  };
}

export class DynamoVoiceRecordingRepository implements VoiceRecordingRepository {
  async getById(id: string): Promise<VoiceRecording | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(id), SK: sk(id) },
      }),
    );
    return result.Item ? fromItem(result.Item) : null;
  }

  async listByChannel(params: {
    workspaceId: string;
    channelId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<VoiceRecording>> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": channelIndex(params.workspaceId, params.channelId),
        },
        ScanIndexForward: false,
        Limit: params.limit,
        ExclusiveStartKey: decodeNextToken(params.nextToken),
      }),
    );
    return {
      items: (result.Items ?? []).map(fromItem).filter((item) => item.status !== "DELETED"),
      nextToken: encodeNextToken(result.LastEvaluatedKey),
    };
  }

  async create(recording: VoiceRecording): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Item: toItem(recording),
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  }

  async update(recording: VoiceRecording): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Item: toItem(recording),
      }),
    );
  }

  async claimAiProcessing(recording: VoiceRecording, expectedUpdatedAt: string): Promise<boolean> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(recording),
          ConditionExpression: "updatedAt = :expectedUpdatedAt AND (attribute_not_exists(#aiStatus) OR #aiStatus = :notSent OR #aiStatus = :failed)",
          ExpressionAttributeNames: { "#aiStatus": "aiStatus" },
          ExpressionAttributeValues: {
            ":expectedUpdatedAt": expectedUpdatedAt,
            ":notSent": "NOT_SENT",
            ":failed": "FAILED",
          },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") return false;
      throw error;
    }
  }
}
