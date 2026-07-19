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
  router.get("/:id", guard("permission:workspace.view"), controller.get);
  router.patch("/:id", guard("MEMBER", "ADMIN", "OWNER"), controller.update);
  router.delete("/:id", guard("permission:workspace.delete"), controller.delete_);

  router.get("/:id/members", guard("permission:members.view"), controller.getMembers);
  router.post("/:id/members", guard("permission:members.invite"), controller.addMember);
  router.delete("/:id/members/:userId", guard("permission:members.remove"), controller.removeMember);
  router.post("/:id/attachments/upload-url", guard("permission:chat.upload"), controller.createAttachmentUploadUrl);

  return router;
}
