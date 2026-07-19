import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import {
  text,
  num,
  nullableText,
  isConditionalFailure,
  isTransactionCanceled,
} from "../../infrastructure/aws/dynamodb-utils.js";
import { ConflictError } from "../../shared/errors/app-error.js";
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

function memberPk(workspaceId: string): string {
  return `WS#${workspaceId}`;
}

function memberSk(userId: string): string {
  return `MEMBER#${userId}`;
}

function toMemberItem(workspaceId: string, member: WorkspaceMember): Record<string, unknown> {
  return {
    PK: memberPk(workspaceId),
    SK: memberSk(member.userId),
    entityType: "WS_MEMBER",
    GSI2PK: `USER#${member.userId}`,
    GSI2SK: `WORKSPACE#${workspaceId}`,
    workspaceId,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt,
  };
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
    const ownedResult = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": gsi1pk(userId),
        },
      }),
    );
    const membershipResult = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: {
          ":pk": gsi1pk(userId),
        },
      }),
    );

    const owned = (ownedResult.Items ?? []).map(fromItem);
    const ownedIds = new Set(owned.map((workspace) => workspace.id));
    const memberWorkspaceIds = (membershipResult.Items ?? [])
      .map((item) => text(item.workspaceId))
      .filter((workspaceId) => workspaceId && !ownedIds.has(workspaceId));

    if (memberWorkspaceIds.length === 0) return owned;

    const batchResult = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [env.DYNAMODB_TABLE_MAIN]: {
            Keys: memberWorkspaceIds.slice(0, 100).map((workspaceId) => ({
              PK: pk(workspaceId),
              SK: sk(),
            })),
          },
        },
      }),
    );

    const memberWorkspaces = (batchResult.Responses?.[env.DYNAMODB_TABLE_MAIN] ?? [])
      .map(fromItem);
    return [...owned, ...memberWorkspaces];
  }

  async create(ws: Workspace): Promise<void> {
    try {
      const ownerMember =
        ws.members.find((member) => member.userId === ws.ownerId) ??
        {
          userId: ws.ownerId,
          role: "OWNER" as const,
          joinedAt: ws.createdAt,
          nickname: null,
        };

      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: env.DYNAMODB_TABLE_MAIN,
                Item: toItem(ws),
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            {
              Put: {
                TableName: env.DYNAMODB_TABLE_MAIN,
                Item: toMemberItem(ws.id, ownerMember),
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
          ],
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error) || isTransactionCanceled(error)) {
        throw new ConflictError("Workspace already exists");
      }
      throw error;
    }
  }

  async update(ws: Workspace, expectedVersion: number): Promise<void> {
    const existingMemberKeys: Array<{ PK: string; SK: string; userId: string }> = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await ddb.send(
        new QueryCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": memberPk(ws.id) },
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        }),
      );
      existingMemberKeys.push(...(result.Items ?? []).map((item) => ({
        PK: text(item.PK),
        SK: text(item.SK),
        userId: text(item.userId),
      })).filter((key) => key.PK && key.SK && key.userId));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const currentMemberIds = new Set(ws.members.map((member) => member.userId));
    const removedMemberKeys = existingMemberKeys.filter((key) => !currentMemberIds.has(key.userId));
    const memberPuts = ws.members.slice(0, 90).map((member) => ({
      Put: {
        TableName: env.DYNAMODB_TABLE_MAIN,
        Item: toMemberItem(ws.id, member),
      },
    }));
    const atomicRemovalCount = Math.max(0, 99 - memberPuts.length);
    const atomicMemberDeletes = removedMemberKeys.slice(0, atomicRemovalCount);
    const deferredMemberDeletes = removedMemberKeys.slice(atomicRemovalCount);

    try {
      await ddb.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: env.DYNAMODB_TABLE_MAIN,
                Item: toItem(ws),
                ConditionExpression: "#version = :expectedVersion",
                ExpressionAttributeNames: { "#version": "version" },
                ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
              },
            },
            ...memberPuts,
            ...atomicMemberDeletes.map(({ PK, SK }) => ({
              Delete: {
                TableName: env.DYNAMODB_TABLE_MAIN,
                Key: { PK, SK },
              },
            })),
          ],
        }),
      );
      await Promise.all(deferredMemberDeletes.map(({ PK, SK }) =>
        ddb.send(new DeleteCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Key: { PK, SK },
        })),
      ));
    } catch (error) {
      if (isConditionalFailure(error) || isTransactionCanceled(error)) {
        throw new ConflictError("Workspace version conflict");
      }
      throw error;
    }
  }

  async delete_(id: string): Promise<void> {
    let exclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const members = await ddb.send(
        new QueryCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": memberPk(id) },
          ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
        }),
      );
      const memberKeys = (members.Items ?? [])
        .map((member) => ({ PK: text(member.PK), SK: text(member.SK) }))
        .filter((key) => key.PK && key.SK);
      await Promise.all(memberKeys.map((key) =>
        ddb.send(new DeleteCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Key: key,
        })),
      ));
      exclusiveStartKey = members.LastEvaluatedKey;
    } while (exclusiveStartKey);

    await ddb.send(
      new DeleteCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(id), SK: sk() },
      }),
    );
  }
}
