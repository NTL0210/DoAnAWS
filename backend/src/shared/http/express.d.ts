import type { WorkspacePermission } from "../../modules/auth/auth.permissions.js";
import type { AuthUser, WorkspaceRole } from "../../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }

    interface Locals {
      requestId: string;
      workspaceRole?: WorkspaceRole;
      workspaceRoleId?: string;
      workspacePermissions?: WorkspacePermission[];
      workspaceId?: string;
    }
  }
}

export {};
