import { Router } from "express";
import type { GuardFn } from "../../app/routes.js";
import type { UserController } from "./user.controller.js";

export function buildUserRouter(
  controller: UserController,
  guard: GuardFn,
): Router {
  const router = Router();

  // /me does not require workspace membership — returns the authenticated user
  router.get("/me", controller.getMe);

  router.get("/", guard("permission:members.view"), controller.list);
  router.post("/", guard("permission:members.invite"), controller.create);
  router.get("/by-email", guard("permission:members.view", "permission:members.invite"), controller.getByEmail);
  router.get("/:id", guard("permission:members.view"), controller.get);
  router.patch("/:id", controller.update);
  router.delete("/:id", guard("permission:workspace.delete"), controller.delete);

  return router;
}
