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
  router.post("/invite", guard("ADMIN", "OWNER"), controller.sendInvitation);

  router.get("/", guard("MEMBER", "ADMIN", "OWNER"), controller.list);
  router.post("/", guard("ADMIN", "OWNER"), controller.create);
  router.get("/:id", guard("MEMBER", "ADMIN", "OWNER"), controller.get);
  router.patch("/:id", guard("ADMIN", "OWNER"), controller.update);
  router.post("/:id/upload-url", guard("ADMIN", "OWNER"), controller.createUploadUrl);
  router.post("/:id/process", guard("ADMIN", "OWNER"), controller.process);

  return router;
}
