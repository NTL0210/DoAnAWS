import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import { getBuiltInRolePermissions } from "./auth.permissions.js";
import { WORKSPACE_ROLES } from "./auth.types.js";
import type { WorkspaceMembership, WorkspaceRole } from "./auth.types.js";
import type { WorkspaceAuthorization, WorkspaceRepository } from "./workspace.repository.js";

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
  role: string;
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
    role: typeof item.role === "string" ? item.role : "EMPLOYEE",
    joinedAt: typeof item.joinedAt === "string" ? item.joinedAt : "",
  };
}

export class DynamoWorkspaceRepository implements WorkspaceRepository {
  async getMemberRole(workspaceId: string, userId: string): Promise<string | null> {
    const authorization = await this.getMemberAuthorization(workspaceId, userId);
    return authorization?.roleId ?? null;
  }

  async getMemberAuthorization(workspaceId: string, userId: string): Promise<WorkspaceAuthorization | null> {
    const [memberResult, workspaceResult] = await Promise.all([
      ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(workspaceId), SK: sk(userId) },
      }),
      ),
      ddb.send(new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: `WORKSPACE#${workspaceId}`, SK: "METADATA" },
      })),
    ]);
    const workspace = workspaceResult.Item;
    if (!workspace) return null;
    if (workspace.ownerId === userId) {
      return {
        roleId: "OWNER",
        effectiveRole: "OWNER",
        permissions: getBuiltInRolePermissions("OWNER"),
      };
    }

    const members = Array.isArray(workspace.members) ? workspace.members : [];
    const member = members.find((item) =>
      typeof item === "object" &&
      item !== null &&
      "userId" in item &&
      (item as { userId?: unknown }).userId === userId,
    ) as { role?: string } | undefined;
    const roleId = typeof memberResult.Item?.role === "string"
      ? memberResult.Item.role
      : member?.role;
    if (!roleId) return null;

    if (WORKSPACE_ROLES.includes(roleId as WorkspaceRole)) {
      const effectiveRole = roleId as WorkspaceRole;
      return {
        roleId,
        effectiveRole,
        permissions: getBuiltInRolePermissions(effectiveRole),
      };
    }

    const customRoles: unknown[] = Array.isArray(workspace.customRoles) ? workspace.customRoles : [];
    const customRole = customRoles.find((item): item is { id: string; permissions?: unknown } =>
      typeof item === "object" && item !== null && "id" in item &&
      typeof (item as { id?: unknown }).id === "string" &&
      (item as { id: string }).id === roleId,
    );
    if (!customRole) return null;
    const permissions = Array.isArray(customRole.permissions)
      ? customRole.permissions.filter((permission): permission is string => typeof permission === "string")
      : [];
    return {
      roleId,
      effectiveRole: "MEMBER",
      permissions: permissions as WorkspaceAuthorization["permissions"],
    };
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

  async setMemberRole(workspaceId: string, userId: string, role: string): Promise<void> {
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
