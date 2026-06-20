import { Router } from "express";
import type { UserController } from "./user.controller.js";

export function buildUserRouter(controller: UserController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/by-email", controller.getByEmail);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.delete);
  return router;
}
