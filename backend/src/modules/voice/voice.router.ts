import { Router } from "express";
import type { VoiceController } from "./voice.controller.js";

export function buildVoiceRouter(controller: VoiceController): Router {
  const router = Router();

  router.get("/ice-servers", controller.getIceServers);

  return router;
}
