import type { AuthUser, WorkspaceRole } from "../../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }

    interface Locals {
      requestId: string;
      workspaceRole?: WorkspaceRole;
      workspaceId?: string;
    }
  }
}

export {};
