import { Router } from "express";
import type { GuardFn } from "../../app/routes.js";
import type { TaskController } from "./task.controller.js";

export function buildTaskRouter(
  controller: TaskController,
  guard: GuardFn,
): Router {
  const router = Router();

  router.get("/", guard("MEMBER", "ADMIN", "OWNER"), controller.list);
  router.post("/", guard("ADMIN", "OWNER"), controller.create);
  router.get("/:id", guard("MEMBER", "ADMIN", "OWNER"), controller.get);
  router.patch("/:id", guard("ADMIN", "OWNER"), controller.update);

  return router;
}
