import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import {
  text,
  num,
  bool,
  nullableText,
  isConditionalFailure,
} from "../../infrastructure/aws/dynamodb-utils.js";
import { ConflictError, NotFoundError } from "../../shared/errors/app-error.js";
import type { WorkspaceRepository } from "./workspace.repository.js";
import type { Workspace, WorkspaceMember, WorkspaceChannel, WorkspaceTeam } from "./workspace.types.js";

const entityType = "WORKSPACE";

function pk(workspaceId: string): string {
  return `WORKSPACE#${workspaceId}`;
}

function sk(): string {
  return `METADATA`;
}

function gsi1pk(ownerId: string): string {
  return `USER#${ownerId}`;
}

function gsi1sk(workspaceId: string): string {
  return `WORKSPACE#${workspaceId}`;
}

interface WorkspaceItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  entityType: string;
  GSI1PK: string;
  GSI1SK: string;
}

function toItem(ws: Workspace): WorkspaceItem {
  return {
    PK: pk(ws.id),
    SK: sk(),
    entityType,
    GSI1PK: gsi1pk(ws.ownerId),
    GSI1SK: gsi1sk(ws.id),
    ...ws,
  };
}

function fromItem(item: Record<string, unknown>): Workspace {
  return {
    id: text(item.id),
    name: text(item.name),
    description: nullableText(item.description) ?? "",
    iconColor: nullableText(item.iconColor) ?? "blue",
    workspaceType: nullableText(item.workspaceType) ?? "blank",
    visibility: nullableText(item.visibility) ?? "private",
    slug: text(item.slug),
    ownerId: text(item.ownerId),
    memberIds: (item.memberIds as string[]) ?? [],
    members: (item.members as WorkspaceMember[]) ?? [],
    channels: (item.channels as WorkspaceChannel[]) ?? [],
    teams: (item.teams as WorkspaceTeam[]) ?? [],
    tasks: (item.tasks as string[]) ?? [],
    meetings: (item.meetings as string[]) ?? [],
    messages: (item.messages as Record<string, unknown>) ?? {},
    notifications: (item.notifications as string[]) ?? [],
    invitations: (item.invitations as string[]) ?? [],
    voiceRecords: (item.voiceRecords as string[]) ?? [],
    customRoles: (item.customRoles as unknown[]) ?? [],
    features: (item.features as unknown[]) ?? [],
    version: num(item.version, 1),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  };
}

export class DynamoWorkspaceRepository implements WorkspaceRepository {
  async findById(id: string): Promise<Workspace | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(id), SK: sk() },
      }),
    );
    return result.Item ? fromItem(result.Item) : null;
  }

  async findByUserId(userId: string): Promise<Workspace[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": gsi1pk(userId),
        },
      }),
    );
    return (result.Items ?? []).map(fromItem);
  }

  async create(ws: Workspace): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(ws),
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) {
        throw new ConflictError("Workspace already exists");
      }
      throw error;
    }
  }

  async update(ws: Workspace, expectedVersion: number): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(ws),
          ConditionExpression: "#version = :expectedVersion",
          ExpressionAttributeNames: { "#version": "version" },
          ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) {
        throw new ConflictError("Workspace version conflict");
      }
      throw error;
    }
  }

  async delete_(id: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(id), SK: sk() },
      }),
    );
  }
}
