import { Router } from "express";
import type { GuardFn } from "../../app/routes.js";
import type { WorkspaceController } from "./workspace.controller.js";

export function buildWorkspaceRouter(
  controller: WorkspaceController,
  guard: GuardFn,
): Router {
  const router = Router();

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:id", guard("MEMBER", "ADMIN", "OWNER"), controller.get);
  router.patch("/:id", guard("MEMBER", "ADMIN", "OWNER"), controller.update);
  router.delete("/:id", guard("OWNER"), controller.delete_);

  router.get("/:id/members", guard("MEMBER", "ADMIN", "OWNER"), controller.getMembers);
  router.post("/:id/members", guard("ADMIN", "OWNER"), controller.addMember);
  router.delete("/:id/members/:userId", guard("ADMIN", "OWNER"), controller.removeMember);
  router.post("/:id/attachments/upload-url", guard("MEMBER", "ADMIN", "OWNER"), controller.createAttachmentUploadUrl);

  return router;
}
