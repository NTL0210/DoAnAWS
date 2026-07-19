import { Router } from "express";
import type { GuardFn } from "../../app/routes.js";
import type { MeetingController } from "./meeting.controller.js";

export function buildMeetingRouter(
  controller: MeetingController,
  guard: GuardFn,
): Router {
  const router = Router();

  router.get("/notifications", controller.listNotifications);
  router.patch("/notifications/:id", controller.updateNotification);
  router.post("/invite", guard("permission:members.invite"), controller.sendInvitation);

  router.get("/", guard("permission:meetings.join", "permission:meetings.manage"), controller.list);
  router.post("/", guard("permission:meetings.create"), controller.create);
  router.get("/:id", guard("permission:meetings.join", "permission:meetings.manage"), controller.get);
  router.patch("/:id", guard("permission:meetings.manage"), controller.update);
  router.delete("/:id", guard("permission:meetings.manage"), controller.delete);
  router.post("/:id/upload-url", guard("permission:meetings.record"), controller.createUploadUrl);
  router.post("/:id/process", guard("permission:meetings.manage"), controller.process);

  return router;
}
