import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../shared/errors/app-error.js";
import type { WorkspaceRole } from "../auth/auth.types.js";
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
      const assigneeId = isEmployeeRole(role) ? req.user?.userId : input.assigneeId;
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
      if (isEmployeeRole(role) && task.assigneeId !== req.user?.userId) {
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

function isEmployeeRole(role: WorkspaceRole | null): boolean {
  return role === "MEMBER" || role === "EMPLOYEE";
}

function authorizeTaskUpdate(params: {
  current: Awaited<ReturnType<TaskService["get"]>>;
  patch: ReturnType<typeof updateTaskSchema.parse>;
  actorId: string | undefined;
  role: WorkspaceRole | null;
}): void {
  const { current, patch, actorId, role } = params;
  if (!role) {
    throw new ForbiddenError("Workspace role is required to update a task");
  }
  const isAssignee = Boolean(actorId && current.assigneeId === actorId);

  if (isAssignee) {
    const changedFields = Object.keys(patch).filter((field) => field !== "expectedVersion");
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

  if (isEmployeeRole(role)) {
    throw new ForbiddenError("Only the assigned user can update this task");
  }

  if (patch.status !== undefined) {
    const isReviewer = role === "OWNER" || role === "VICE_ADMIN" || role === "ADMIN";
    const isApproval = current.status === "REVIEW" && patch.status === "COMPLETED";
    if (!isReviewer || !isApproval) {
      throw new ForbiddenError("Managers can edit task details, while owner or vice admin can approve tasks in review");
    }
  }
}
