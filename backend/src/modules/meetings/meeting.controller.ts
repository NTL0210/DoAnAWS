import type { NextFunction, Request, Response } from "express";
import { toMeetingResponse } from "./meeting.mapper.js";
import {
  createMeetingSchema,
  idParamsSchema,
  listMeetingsSchema,
  listNotificationsSchema,
  sendInvitationSchema,
  updateNotificationSchema,
  updateMeetingSchema,
} from "./meeting.schemas.js";
import type { MeetingService } from "./meeting.service.js";
import { NotificationRepository } from "./notification.repository.js";
import type { UserService } from "../users/user.service.js";
import type { WorkspaceService } from "../workspaces/workspace.service.js";

export class MeetingController {
  private readonly notifications = new NotificationRepository();

  constructor(
    private readonly service: MeetingService,
    private readonly users: UserService,
    private readonly workspaces: WorkspaceService,
  ) {}

  listNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      const query = listNotificationsSchema.parse(req.query);
      const notifications = await this.notifications.findByUser(
        req.user.userId,
        query.unreadOnly === undefined ? {} : { unreadOnly: query.unreadOnly },
      );
      res.status(200).json({ notifications });
    } catch (error) {
      next(error);
    }
  };

  updateNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      const params = idParamsSchema.parse(req.params);
      const body = updateNotificationSchema.parse(req.body);
      const current = await this.notifications.findById(req.user.userId, params.id);
      if (!current) {
        res.status(404).json({ message: "Notification not found" });
        return;
      }

      const status =
        body.action === "accept" ? "ACCEPTED" : body.action === "decline" ? "DECLINED" : "READ";

      if (status === "ACCEPTED" && current.type === "INVITATION") {
        const workspaceId = textMetadata(current.metadata, "workspaceId");
        const role = textMetadata(current.metadata, "role") || "EMPLOYEE";
        if (workspaceId) {
          await this.workspaces.addMember(
            workspaceId,
            req.user.userId,
            role === "OWNER" || role === "VICE_ADMIN" || role === "MANAGER" || role === "EMPLOYEE"
              ? role
              : "EMPLOYEE",
          );
        }
      }

      const updated = await this.notifications.updateStatus(req.user.userId, params.id, status);
      res.status(200).json(updated ?? { id: params.id, status });
    } catch (error) {
      next(error);
    }
  };

  sendInvitation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      const input = sendInvitationSchema.parse(req.body);
      const invitee = await this.users.getByEmail(input.inviteeEmail);
      if (!invitee) {
        res.status(404).json({ message: "Invitee user not found" });
        return;
      }

      const workspace = await this.workspaces.get(input.workspaceId);
      const senderName = req.user.name || req.user.email || "A teammate";
      const notification = await this.notifications.create({
        userId: invitee.id,
        type: "INVITATION",
        title: `Invitation to ${workspace.name}`,
        message: `${senderName} invited you to join ${workspace.name}.`,
        link: "/notifications",
        metadata: {
          status: "PENDING",
          workspaceId: workspace.id,
          workspaceName: input.workspaceName || workspace.name,
          invitedBy: req.user.userId,
          invitedByUserName: senderName,
          invitedEmail: invitee.email,
          role: input.role,
          teamIds: input.teamIds,
        },
      });

      res.status(202).json({ accepted: true, notification });
    } catch (error) {
      next(error);
    }
  };

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

  process = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const workspaceId = res.locals.workspaceId ?? "";
      const meeting = await this.service.process({
        workspaceId,
        meetingId: params.id,
      });
      res.status(200).json(toMeetingResponse(meeting));
    } catch (error) {
      next(error);
    }
  };
}

function textMetadata(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}
