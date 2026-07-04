import type { NextFunction, Request, Response } from "express";
import { toWorkspaceResponse } from "./workspace.mapper.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  listWorkspacesSchema,
  idParamsSchema,
  addMemberSchema,
  removeMemberParamsSchema,
} from "./workspace.schemas.js";
import type { WorkspaceService } from "./workspace.service.js";
import type { WorkspaceChannel, WorkspaceMember, WorkspaceTeam } from "./workspace.types.js";

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
      const member = await this.service.addMember(params.id, body.userId, body.role);
      res.status(201).json(member);
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
