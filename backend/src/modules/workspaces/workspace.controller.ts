import type { NextFunction, Request, Response } from "express";
import { getBuiltInRolePermissions } from "../auth/auth.permissions.js";
import type { WorkspacePermission } from "../auth/auth.permissions.js";
import type { WorkspaceRole } from "../auth/auth.types.js";
import { toWorkspaceResponse } from "./workspace.mapper.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  listWorkspacesSchema,
  idParamsSchema,
  addMemberSchema,
  removeMemberParamsSchema,
  createWorkspaceAttachmentUploadUrlSchema,
} from "./workspace.schemas.js";
import type { WorkspaceService } from "./workspace.service.js";
import type { Workspace, WorkspaceChannel, WorkspaceCustomRole, WorkspaceMember, WorkspaceTeam } from "./workspace.types.js";

export class WorkspaceController {
  constructor(private readonly service: WorkspaceService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      listWorkspacesSchema.parse(req.query);
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required",
            requestId: res.locals.requestId,
          },
        });
        return;
      }
      const workspaces = await this.service.list(userId);
      res.status(200).json(workspaces.map(toWorkspaceResponse));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const workspace = await this.service.get(params.id);
      res.status(200).json(toWorkspaceResponse(workspace));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createWorkspaceSchema.parse(req.body);
      const ownerId = req.user?.userId;
      if (!ownerId) {
        res.status(401).json({
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required",
            requestId: res.locals.requestId,
          },
        });
        return;
      }
      const workspace = await this.service.create({
        name: input.name,
        ownerId,
        ...(input.description !== undefined && { description: input.description }),
        ...(input.iconColor !== undefined && { iconColor: input.iconColor }),
        ...(input.workspaceType !== undefined && { workspaceType: input.workspaceType }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
      });
      res.status(201).json(toWorkspaceResponse(workspace));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const patch = updateWorkspaceSchema.parse(req.body);
      const role = roleFromLocals(res.locals.workspaceRole);
      const permissions = permissionsFromLocals(role, res.locals.workspacePermissions);
      const currentWorkspace = patch.customRoles !== undefined || patch.members !== undefined ||
          patch.teams !== undefined || patch.channels !== undefined
        ? await this.service.get(params.id)
        : null;
      if (!canApplyWorkspacePatch(patch, permissions, currentWorkspace)) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Your workspace role does not have permission to apply this change",
            requestId: res.locals.requestId,
          },
        });
        return;
      }
      if (patch.customRoles && role !== "OWNER" && role !== "ADMIN") {
        const currentRolesById = new Map(
          (currentWorkspace?.customRoles ?? []).map((customRole) => [customRole.id, customRole]),
        );
        const attemptsPrivilegeEscalation = patch.customRoles.some((customRole) => {
          const currentRole = currentRolesById.get(customRole.id);
          const permissionsChanged = !currentRole ||
            !samePermissions(currentRole.permissions, customRole.permissions);
          return permissionsChanged && customRole.permissions.some(
            (permission) => !permissions.includes(permission),
          );
        });
        if (attemptsPrivilegeEscalation) {
          res.status(403).json({
            error: {
              code: "FORBIDDEN",
              message: "You cannot grant permissions that your own role does not have",
              requestId: res.locals.requestId,
            },
          });
          return;
        }
      }
      if (patch.members && currentWorkspace && role !== "OWNER" && role !== "ADMIN") {
        const customRoles = patch.customRoles ?? currentWorkspace.customRoles;
        const currentMembersById = new Map(
          currentWorkspace.members.map((member) => [member.userId, member]),
        );
        const attemptsRoleEscalation = patch.members.some((member) => {
          if (currentMembersById.get(member.userId)?.role === member.role) return false;
          return !canAssignRole(member.role, customRoles, permissions);
        });
        if (attemptsRoleEscalation) {
          res.status(403).json({
            error: {
              code: "FORBIDDEN",
              message: "You cannot assign a role with permissions above your own role",
              requestId: res.locals.requestId,
            },
          });
          return;
        }
      }
      // Remove undefined values from sub-entity arrays to satisfy exactOptionalPropertyTypes
      const cleanChannels = patch.channels?.map((ch) =>
        structuredClone(ch),
      ) as WorkspaceChannel[] | undefined;
      const cleanTeams = patch.teams?.map((t) =>
        structuredClone(t),
      ) as WorkspaceTeam[] | undefined;
      const cleanMembers = patch.members?.map((m) =>
        structuredClone(m),
      ) as WorkspaceMember[] | undefined;
      const cleanCustomRoles = patch.customRoles?.map((role) =>
        structuredClone(role),
      ) as WorkspaceCustomRole[] | undefined;

      const workspace = await this.service.update(params.id, {
        expectedVersion: patch.expectedVersion,
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.iconColor !== undefined && { iconColor: patch.iconColor }),
        ...(patch.visibility !== undefined && { visibility: patch.visibility }),
        ...(cleanChannels !== undefined && { channels: cleanChannels }),
        ...(cleanTeams !== undefined && { teams: cleanTeams }),
        ...(cleanMembers !== undefined && { members: cleanMembers }),
        ...(patch.messages !== undefined && { messages: patch.messages }),
        ...(patch.voiceRecords !== undefined && { voiceRecords: patch.voiceRecords }),
        ...(cleanCustomRoles !== undefined && { customRoles: cleanCustomRoles }),
      });
      res.status(200).json(toWorkspaceResponse(workspace));
    } catch (error) {
      next(error);
    }
  };

  delete_ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      await this.service.delete_(params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const members = await this.service.getMembers(params.id);
      res.status(200).json(members);
    } catch (error) {
      next(error);
    }
  };

  addMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const body = addMemberSchema.parse(req.body);
      const role = roleFromLocals(res.locals.workspaceRole);
      const permissions = permissionsFromLocals(role, res.locals.workspacePermissions);
      if (role !== "OWNER" && role !== "ADMIN") {
        const workspace = await this.service.get(params.id);
        if (!canAssignRole(body.role, workspace.customRoles, permissions)) {
          res.status(403).json({
            error: {
              code: "FORBIDDEN",
              message: "You cannot invite a member into a role above your own permissions",
              requestId: res.locals.requestId,
            },
          });
          return;
        }
      }
      const member = await this.service.addMember(params.id, body.userId, body.role);
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  };

  createAttachmentUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required",
            requestId: res.locals.requestId,
          },
        });
        return;
      }
      const body = createWorkspaceAttachmentUploadUrlSchema.parse(req.body);
      const upload = await this.service.createAttachmentUpload(params.id, userId, {
        fileName: body.fileName,
        contentType: body.contentType,
      });
      res.status(200).json(upload);
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = removeMemberParamsSchema.parse(req.params);
      await this.service.removeMember(params.id, params.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

function roleFromLocals(value: unknown): WorkspaceRole | null {
  return typeof value === "string" ? value as WorkspaceRole : null;
}

function permissionsFromLocals(
  role: WorkspaceRole | null,
  permissions: WorkspacePermission[] | undefined,
): WorkspacePermission[] {
  if (permissions) return permissions;
  return role ? getBuiltInRolePermissions(role) : [];
}

function canApplyWorkspacePatch(
  patch: Record<string, unknown>,
  permissions: WorkspacePermission[],
  currentWorkspace: Workspace | null,
): boolean {
  const hasAny = (...required: WorkspacePermission[]) =>
    required.some((permission) => permissions.includes(permission));
  if (patch.customRoles !== undefined && !hasAny("roles.manage")) return false;
  if (patch.members !== undefined && !hasAny("roles.manage")) return false;
  if (patch.teams !== undefined) {
    if (!currentWorkspace) return false;
    const nextTeams = patch.teams as WorkspaceTeam[];
    const currentById = new Map(currentWorkspace.teams.map((team) => [team.id, team]));
    const nextIds = new Set(nextTeams.map((team) => team.id));
    if (nextTeams.some((team) => !currentById.has(team.id)) && !hasAny("teams.create")) return false;
    if (currentWorkspace.teams.some((team) => !nextIds.has(team.id)) && !hasAny("teams.delete")) return false;
    if (nextTeams.some((team) => {
      const current = currentById.get(team.id);
      return current && !sameEntity(current, team);
    }) && !hasAny("teams.manage")) return false;
  }
  if (patch.channels !== undefined) {
    if (!currentWorkspace) return false;
    const nextChannels = patch.channels as WorkspaceChannel[];
    const currentById = new Map(currentWorkspace.channels.map((channel) => [channel.id, channel]));
    const nextIds = new Set(nextChannels.map((channel) => channel.id));
    if (nextChannels.some((channel) => !currentById.has(channel.id)) && !hasAny("channels.create")) return false;
    if (currentWorkspace.channels.some((channel) => !nextIds.has(channel.id)) && !hasAny("channels.delete")) return false;
    const changedChannels = nextChannels.filter((channel) => {
      const current = currentById.get(channel.id);
      return current && !sameEntity(current, channel);
    });
    if (changedChannels.some((channel) => channel.type !== "voice") && !hasAny("channels.manage")) return false;
    if (changedChannels.some((channel) => channel.type === "voice") &&
        !hasAny("channels.manage", "voice.manage")) return false;
  }
  if (["name", "description", "iconColor", "visibility"].some((key) => patch[key] !== undefined) &&
      !hasAny("workspace.manage")) return false;
  if (patch.messages !== undefined && !hasAny("chat.send")) return false;
  if (patch.voiceRecords !== undefined && !hasAny("voice.record", "voice.manage")) return false;
  return true;
}

function sameEntity(left: object, right: object): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function samePermissions(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((permission) => rightSet.has(permission));
}

function canAssignRole(
  roleId: string,
  customRoles: WorkspaceCustomRole[],
  actorPermissions: WorkspacePermission[],
): boolean {
  if (roleId === "OWNER" || roleId === "ADMIN") return false;
  const builtInRoles = new Set<WorkspaceRole>(["VICE_ADMIN", "MANAGER", "EMPLOYEE"]);
  const targetPermissions = builtInRoles.has(roleId as WorkspaceRole)
    ? getBuiltInRolePermissions(roleId as WorkspaceRole)
    : customRoles.find((customRole) => customRole.id === roleId)?.permissions;
  if (!targetPermissions) return false;
  return targetPermissions.every((permission) =>
    actorPermissions.includes(permission as WorkspacePermission),
  );
}
