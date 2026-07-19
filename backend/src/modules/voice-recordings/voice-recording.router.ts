import { Router } from "express";
import type { GuardFn } from "../../app/routes.js";
import type { VoiceRecordingController } from "./voice-recording.controller.js";

export function buildVoiceRecordingRouter(
  controller: VoiceRecordingController,
  guard: GuardFn,
): Router {
  const router = Router();
  router.get("/", guard("permission:meetings.join", "permission:voice.record"), controller.list);
  router.post("/", guard("permission:voice.record"), controller.create);
  router.post("/:id/upload-url", guard("permission:voice.record"), controller.createUploadUrl);
  router.patch("/:id", guard("permission:voice.record", "permission:voice.manage"), controller.update);
  router.post("/:id/send-to-ai", guard("permission:voice.record"), controller.sendToAi);
  router.delete("/:id", guard("permission:voice.manage"), controller.delete);
  return router;
}
