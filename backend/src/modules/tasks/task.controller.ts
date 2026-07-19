import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../shared/errors/app-error.js";
import type { WorkspaceRole } from "../auth/auth.types.js";
import { getBuiltInRolePermissions } from "../auth/auth.permissions.js";
import type { WorkspacePermission } from "../auth/auth.permissions.js";
import {
  createTaskSchema,
  idParamsSchema,
  listTasksSchema,
  updateTaskSchema,
} from "./task.schemas.js";
import type { TaskService } from "./task.service.js";
import { toTaskResponse } from "./task.mapper.js";

export class TaskController {
  constructor(private readonly service: TaskService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = listTasksSchema.parse(req.query);
      const workspaceId = res.locals.workspaceId ?? input.workspaceId ?? "";
      const role = roleFromLocals(res.locals.workspaceRole);
      const permissions = permissionsFromLocals(role, res.locals.workspacePermissions);
      const assigneeId = permissions.includes("tasks.manage_all") ? input.assigneeId : req.user?.userId;
      const result = await this.service.list({ ...input, workspaceId, assigneeId });
      res.status(200).json({
        items: result.items.map(toTaskResponse),
        nextToken: result.nextToken,
      });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const workspaceId = res.locals.workspaceId ?? "";
      const task = await this.service.get({
        workspaceId,
        taskId: params.id,
      });
      const role = roleFromLocals(res.locals.workspaceRole);
      const permissions = permissionsFromLocals(role, res.locals.workspacePermissions);
      if (!permissions.includes("tasks.manage_all") && task.assigneeId !== req.user?.userId) {
        throw new ForbiddenError("You can only view tasks assigned to you");
      }
      res.status(200).json(toTaskResponse(task));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createTaskSchema.parse(req.body);
      const workspaceId = res.locals.workspaceId ?? input.workspaceId ?? "";
      const role = roleFromLocals(res.locals.workspaceRole);
      const permissions = permissionsFromLocals(role, res.locals.workspacePermissions);
      if (input.assigneeId && input.assigneeId !== req.user?.userId && !permissions.includes("tasks.assign")) {
        throw new ForbiddenError("Task assignment permission is required to assign another member");
      }
      const task = await this.service.create({
        ...input,
        workspaceId,
        createdBy: input.createdBy ?? req.user?.userId,
      });
      res.status(201).json(toTaskResponse(task));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const patch = updateTaskSchema.parse(req.body);
      const workspaceId = res.locals.workspaceId ?? "";
      const current = await this.service.get({ workspaceId, taskId: params.id });
      authorizeTaskUpdate({
        current,
        patch,
        actorId: req.user?.userId,
        role: roleFromLocals(res.locals.workspaceRole),
        permissions: permissionsFromLocals(
          roleFromLocals(res.locals.workspaceRole),
          res.locals.workspacePermissions,
        ),
      });
      const task = await this.service.update({
        workspaceId,
        taskId: params.id,
        patch,
      });
      res.status(200).json(toTaskResponse(task));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const workspaceId = res.locals.workspaceId ?? "";
      await this.service.delete({
        workspaceId,
        taskId: params.id,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

function roleFromLocals(value: unknown): WorkspaceRole | null {
  return typeof value === "string" ? value as WorkspaceRole : null;
}

function authorizeTaskUpdate(params: {
  current: Awaited<ReturnType<TaskService["get"]>>;
  patch: ReturnType<typeof updateTaskSchema.parse>;
  actorId: string | undefined;
  role: WorkspaceRole | null;
  permissions: WorkspacePermission[];
}): void {
  const { current, patch, actorId, role, permissions } = params;
  if (!role) {
    throw new ForbiddenError("Workspace role is required to update a task");
  }
  const isAssignee = Boolean(actorId && current.assigneeId === actorId);
  const changedFields = Object.keys(patch).filter((field) => field !== "expectedVersion");
  const isReviewer = permissions.includes("tasks.approve");
  const canManageDetails = permissions.includes("tasks.manage_all");
  const isApproval = current.status === "REVIEW" && patch.status === "COMPLETED";

  if (isReviewer && isApproval) {
    if (changedFields.some((field) => !["status", "progress"].includes(field))) {
      throw new ForbiddenError("Task approval can only update status or progress");
    }
    return;
  }

  if (patch.status === undefined && canManageDetails) return;

  if (isAssignee) {
    if (!permissions.includes("tasks.update_status")) {
      throw new ForbiddenError("Task status update permission is required");
    }
    if (changedFields.some((field) => !["status", "progress"].includes(field))) {
      throw new ForbiddenError("Assigned users can only update task status or progress");
    }
    if (patch.status !== undefined) {
      const isStarting = current.status === "PENDING" && patch.status === "IN_PROGRESS";
      const isSubmitting = ["IN_PROGRESS", "OVERDUE"].includes(current.status) && patch.status === "REVIEW";
      if (!isStarting && !isSubmitting) {
        throw new ForbiddenError("Assigned users can only start pending tasks or send active work to review");
      }
    }
    return;
  }

  if (!canManageDetails) {
    throw new ForbiddenError("Only the assigned user can update this task");
  }

  if (patch.status !== undefined) {
    if (!isReviewer || !isApproval) {
      throw new ForbiddenError("Managers can edit task details, while owner or vice admin can approve tasks in review");
    }
  }
}

function permissionsFromLocals(
  role: WorkspaceRole | null,
  permissions: WorkspacePermission[] | undefined,
): WorkspacePermission[] {
  if (permissions) return permissions;
  return role ? getBuiltInRolePermissions(role) : [];
}
