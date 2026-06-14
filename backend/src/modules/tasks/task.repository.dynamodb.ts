import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import { ConflictError } from "../../shared/errors/app-error.js";
import {
  decodeNextToken,
  encodeNextToken
} from "../../shared/pagination/token.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { TaskRepository } from "./task.repository.js";
import type { Task } from "./task.types.js";

const entityType = "TASK";

function pk(workspaceId: string): string {
  return `WORKSPACE#${workspaceId}`;
}

function sk(taskId: string): string {
  return `TASK#${taskId}`;
}

type TaskItem = Task & {
  PK: string;
  SK: string;
  entityType: typeof entityType;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK?: string | undefined;
  GSI2SK?: string | undefined;
};

function toItem(task: Task): TaskItem {
  return {
    PK: pk(task.workspaceId),
    SK: sk(task.id),
    entityType,
    GSI1PK: `WORKSPACE#${task.workspaceId}#TASKS`,
    GSI1SK: `${task.createdAt}#${task.id}`,
    GSI2PK: task.assigneeId
      ? `WORKSPACE#${task.workspaceId}#ASSIGNEE#${task.assigneeId}`
      : undefined,
    GSI2SK: `${task.deadline ?? "NO_DEADLINE"}#${task.id}`,
    ...task
  };
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function fromItem(item: Record<string, unknown>): Task {
  return {
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    meetingId: item.meetingId ? text(item.meetingId) : null,
    sourceMeetingId: item.sourceMeetingId ? text(item.sourceMeetingId) : null,
    title: text(item.title),
    description: text(item.description),
    assigneeId: item.assigneeId ? text(item.assigneeId) : null,
    createdBy: item.createdBy ? text(item.createdBy) : null,
    priority: item.priority as Task["priority"],
    status: item.status as Task["status"],
    progress: Number(item.progress),
    deadline: item.deadline ? text(item.deadline) : null,
    generatedFromAI: Boolean(item.generatedFromAI),
    aiConfidence: typeof item.aiConfidence === "number" ? item.aiConfidence : null,
    version: Number(item.version),
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

export class DynamoTaskRepository implements TaskRepository {
  async getById(params: {
    workspaceId: string;
    taskId: string;
  }): Promise<Task | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(params.workspaceId), SK: sk(params.taskId) }
      }),
    );
    return result.Item ? fromItem(result.Item) : null;
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
    assigneeId?: string | undefined;
    meetingId?: string | undefined;
  }): Promise<PaginatedResult<Task>> {
    if (params.assigneeId) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          IndexName: "GSI2",
          KeyConditionExpression: "GSI2PK = :pk",
          ExpressionAttributeValues: {
            ":pk": `WORKSPACE#${params.workspaceId}#ASSIGNEE#${params.assigneeId}`
          },
          Limit: params.limit,
          ExclusiveStartKey: decodeNextToken(params.nextToken)
        }),
      );
      return {
        items: (result.Items ?? []).map(fromItem),
        nextToken: encodeNextToken(result.LastEvaluatedKey)
      };
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        FilterExpression: params.meetingId ? "sourceMeetingId = :meetingId" : undefined,
        ExpressionAttributeValues: {
          ":pk": `WORKSPACE#${params.workspaceId}#TASKS`,
          ...(params.meetingId ? { ":meetingId": params.meetingId } : {})
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

  async create(task: Task): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(task),
          ConditionExpression: "attribute_not_exists(PK)"
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConflictError("Task already exists");
      throw error;
    }
  }

  async update(task: Task, expectedVersion: number): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(task),
          ConditionExpression: "#version = :expectedVersion",
          ExpressionAttributeNames: { "#version": "version" },
          ExpressionAttributeValues: { ":expectedVersion": expectedVersion }
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConflictError("Task version conflict");
      throw error;
    }
  }

  async batchCreate(tasks: Task[]): Promise<void> {
    let writeRequests: NonNullable<
      ConstructorParameters<typeof BatchWriteCommand>[0]["RequestItems"]
    >[string] = tasks.map((task) => ({
      PutRequest: { Item: toItem(task) }
    }));

    for (let attempt = 0; writeRequests.length > 0 && attempt < 5; attempt += 1) {
      const result = await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [env.DYNAMODB_TABLE_MAIN]: writeRequests
          }
        }),
      );
      writeRequests = result.UnprocessedItems?.[env.DYNAMODB_TABLE_MAIN] ?? [];
    }
  }

  async createManyForMeetingTransaction(params: {
    workspaceId: string;
    meetingId: string;
    tasks: Task[];
  }): Promise<void> {
    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: env.DYNAMODB_TABLE_MAIN,
                Key: { PK: pk(params.workspaceId), SK: `MEETING#${params.meetingId}` },
                UpdateExpression: "SET updatedAt = :now",
                ConditionExpression: "attribute_exists(PK)",
                ExpressionAttributeValues: { ":now": new Date().toISOString() }
              }
            },
            ...params.tasks.map((task) => ({
              Put: {
                TableName: env.DYNAMODB_TABLE_MAIN,
                Item: toItem(task),
                ConditionExpression: "attribute_not_exists(PK)"
              }
            }))
          ]
        }),
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "TransactionCanceledException"
      ) {
        throw new ConflictError("Could not create tasks for meeting atomically");
      }
      throw error;
    }
  }
}
