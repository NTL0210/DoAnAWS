import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import {
  text,
  num,
  bool,
  nullableText,
  nullableNum,
  isConditionalFailure,
  isTransactionCanceled,
} from "../../infrastructure/aws/dynamodb-utils.js";
import { ConflictError } from "../../shared/errors/app-error.js";
import { decodeNextToken, encodeNextToken } from "../../shared/pagination/token.js";
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

function toItem(task: Task): Record<string, unknown> {
  const item: Record<string, unknown> = {
    PK: pk(task.workspaceId),
    SK: sk(task.id),
    entityType,
    GSI1PK: `WORKSPACE#${task.workspaceId}#TASKS`,
    GSI1SK: `${task.createdAt}#${task.id}`,
    ...task,
  };

  if (task.assigneeId) {
    item.GSI2PK = `WORKSPACE#${task.workspaceId}#ASSIGNEE#${task.assigneeId}`;
    item.GSI2SK = `${task.deadline ?? "NO_DEADLINE"}#${task.id}`;
  }

  return item;
}

function fromItem(item: Record<string, unknown>): Task {
  return {
    id: text(item.id),
    workspaceId: text(item.workspaceId),
    meetingId: nullableText(item.meetingId),
    sourceMeetingId: nullableText(item.sourceMeetingId),
    title: text(item.title),
    description: text(item.description),
    assigneeId: nullableText(item.assigneeId),
    createdBy: nullableText(item.createdBy),
    priority: text(item.priority, "MEDIUM") as Task["priority"],
    status: text(item.status, "PENDING") as Task["status"],
    progress: num(item.progress, 0),
    deadline: nullableText(item.deadline),
    generatedFromAI: bool(item.generatedFromAI),
    aiConfidence: nullableNum(item.aiConfidence),
    version: num(item.version, 1),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  };
}

export class DynamoTaskRepository implements TaskRepository {
  async getById(params: {
    workspaceId: string;
    taskId: string;
  }): Promise<Task | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(params.workspaceId), SK: sk(params.taskId) },
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
            ":pk": `WORKSPACE#${params.workspaceId}#ASSIGNEE#${params.assigneeId}`,
          },
          Limit: params.limit,
          ExclusiveStartKey: decodeNextToken(params.nextToken),
        }),
      );
      return {
        items: (result.Items ?? []).map(fromItem),
        nextToken: encodeNextToken(result.LastEvaluatedKey),
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
          ...(params.meetingId ? { ":meetingId": params.meetingId } : {}),
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

  async create(task: Task): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(task),
          ConditionExpression: "attribute_not_exists(PK)",
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
          ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
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
      PutRequest: { Item: toItem(task) },
    }));

    for (let attempt = 0; writeRequests.length > 0 && attempt < 5; attempt++) {
      const result = await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [env.DYNAMODB_TABLE_MAIN]: writeRequests,
          },
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
                ExpressionAttributeValues: { ":now": new Date().toISOString() },
              },
            },
            ...params.tasks.map((task) => ({
              Put: {
                TableName: env.DYNAMODB_TABLE_MAIN,
                Item: toItem(task),
                ConditionExpression: "attribute_not_exists(PK)",
              },
            })),
          ],
        }),
      );
    } catch (error) {
      if (isTransactionCanceled(error)) {
        throw new ConflictError("Could not create tasks for meeting atomically");
      }
      throw error;
    }
  }
}
