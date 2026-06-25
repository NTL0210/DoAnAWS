import type { NextFunction, Request, Response } from "express";
import { toMeetingResponse } from "./meeting.mapper.js";
import {
  createMeetingSchema,
  idParamsSchema,
  listMeetingsSchema,
  updateMeetingSchema,
} from "./meeting.schemas.js";
import type { MeetingService } from "./meeting.service.js";

export class MeetingController {
  constructor(private readonly service: MeetingService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = listMeetingsSchema.parse(req.query);
      const workspaceId = res.locals.workspaceId ?? input.workspaceId ?? "";
      const result = await this.service.list({ ...input, workspaceId });
      res.status(200).json({
        items: result.items.map(toMeetingResponse),
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
      const meeting = await this.service.get({
        workspaceId,
        meetingId: params.id,
      });
      res.status(200).json(toMeetingResponse(meeting));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createMeetingSchema.parse(req.body);
      const workspaceId = res.locals.workspaceId ?? input.workspaceId ?? "";
      const meeting = await this.service.create({
        ...input,
        workspaceId,
        createdBy: input.createdBy ?? req.user?.userId,
      });
      res.status(201).json(toMeetingResponse(meeting));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const patch = updateMeetingSchema.parse(req.body);
      const workspaceId = res.locals.workspaceId ?? "";
      const meeting = await this.service.update({
        workspaceId,
        meetingId: params.id,
        patch,
      });
      res.status(200).json(toMeetingResponse(meeting));
    } catch (error) {
      next(error);
    }
  };
}
