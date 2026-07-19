import { Router } from "express";
import type { GuardFn } from "../../app/routes.js";
import type { TaskController } from "./task.controller.js";

export function buildTaskRouter(
  controller: TaskController,
  guard: GuardFn,
): Router {
  const router = Router();

  router.get("/", guard("permission:tasks.view", "permission:tasks.manage_all"), controller.list);
  router.post("/", guard("permission:tasks.create"), controller.create);
  router.get("/:id", guard("permission:tasks.view", "permission:tasks.manage_all"), controller.get);
  router.patch("/:id", guard("permission:tasks.update_status", "permission:tasks.manage_all", "permission:tasks.approve"), controller.update);
  router.delete("/:id", guard("permission:tasks.delete"), controller.delete);

  return router;
}
