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

  router.get("/", guard("MEMBER", "ADMIN", "OWNER"), controller.list);
  router.post("/", guard("ADMIN", "OWNER"), controller.create);
  router.get("/by-email", guard("MEMBER", "ADMIN", "OWNER"), controller.getByEmail);
  router.get("/:id", guard("MEMBER", "ADMIN", "OWNER"), controller.get);
  router.patch("/:id", guard("ADMIN", "OWNER"), controller.update);
  router.delete("/:id", guard("OWNER"), controller.delete);

  return router;
}
