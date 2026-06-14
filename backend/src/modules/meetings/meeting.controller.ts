import type { NextFunction, Request, Response } from "express";
import { toMeetingResponse } from "./meeting.mapper.js";
import {
  createMeetingSchema,
  idParamsSchema,
  listMeetingsSchema,
  updateMeetingSchema
} from "./meeting.schemas.js";
import type { MeetingService } from "./meeting.service.js";

export class MeetingController {
  constructor(private readonly service: MeetingService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = listMeetingsSchema.parse(req.query);
      const result = await this.service.list(input);
      res.status(200).json({
        items: result.items.map(toMeetingResponse),
        nextToken: result.nextToken
      });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const query = listMeetingsSchema.pick({ workspaceId: true }).parse(req.query);
      const meeting = await this.service.get({
        workspaceId: query.workspaceId,
        meetingId: params.id
      });
      res.status(200).json(toMeetingResponse(meeting));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createMeetingSchema.parse(req.body);
      const meeting = await this.service.create(input);
      res.status(201).json(toMeetingResponse(meeting));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const query = listMeetingsSchema.pick({ workspaceId: true }).parse(req.query);
      const patch = updateMeetingSchema.parse(req.body);
      const meeting = await this.service.update({
        workspaceId: query.workspaceId,
        meetingId: params.id,
        patch
      });
      res.status(200).json(toMeetingResponse(meeting));
    } catch (error) {
      next(error);
    }
  };
}
