import { Router } from "express";
import type { MeetingController } from "./meeting.controller.js";

export function buildMeetingRouter(controller: MeetingController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);
  return router;
}
