import { Router } from "express";
import type { TaskController } from "./task.controller.js";

export function buildTaskRouter(controller: TaskController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);
  return router;
}
