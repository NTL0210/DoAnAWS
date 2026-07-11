import { Router } from "express";
import type { GuardFn } from "../../app/routes.js";
import type { VoiceRecordingController } from "./voice-recording.controller.js";

export function buildVoiceRecordingRouter(
  controller: VoiceRecordingController,
  guard: GuardFn,
): Router {
  const router = Router();
  router.get("/", guard("MEMBER", "ADMIN", "OWNER"), controller.list);
  router.post("/", guard("MEMBER", "ADMIN", "OWNER"), controller.create);
  router.post("/:id/upload-url", controller.createUploadUrl);
  router.patch("/:id", controller.update);
  router.post("/:id/send-to-ai", controller.sendToAi);
  router.delete("/:id", controller.delete);
  return router;
}
