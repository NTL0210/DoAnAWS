import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import type { WorkspaceMembership, WorkspaceRole } from "./auth.types.js";
import type { WorkspaceRepository } from "./workspace.repository.js";

const entityType = "WS_MEMBER";

function pk(workspaceId: string): string {
  return `WS#${workspaceId}`;
}

function sk(userId: string): string {
  return `MEMBER#${userId}`;
}

interface MemberItem {
  PK: string;
  SK: string;
  entityType: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

function toItem(membership: WorkspaceMembership): MemberItem {
  return {
    PK: pk(membership.workspaceId),
    SK: sk(membership.userId),
    entityType,
    workspaceId: membership.workspaceId,
    userId: membership.userId,
    role: membership.role,
    joinedAt: membership.joinedAt,
  };
}

function fromItem(item: Record<string, unknown>): WorkspaceMembership {
  return {
    workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : "",
    userId: typeof item.userId === "string" ? item.userId : "",
    role: item.role as WorkspaceRole,
    joinedAt: typeof item.joinedAt === "string" ? item.joinedAt : "",
  };
}

export class DynamoWorkspaceRepository implements WorkspaceRepository {
  async getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(workspaceId), SK: sk(userId) },
      }),
    );

    if (!result.Item) return null;
    return result.Item.role as WorkspaceRole;
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": pk(workspaceId),
          ":sk": "MEMBER#",
        },
      }),
    );

    return (result.Items ?? []).map(fromItem);
  }

  async setMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    const item = toItem({ workspaceId, userId, role, joinedAt: new Date().toISOString() });
    await ddb.send(
      new PutCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Item: item,
      }),
    );
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(workspaceId), SK: sk(userId) },
      }),
    );
  }
}
