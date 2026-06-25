import type { NextFunction, Request, Response } from "express";
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
      const result = await this.service.list({ ...input, workspaceId });
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
}
