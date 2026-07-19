import type { WorkspacePermission } from "./auth.permissions.js";
import type { WorkspaceMembership, WorkspaceRole } from "./auth.types.js";

export interface WorkspaceAuthorization {
  roleId: string;
  effectiveRole: WorkspaceRole;
  permissions: WorkspacePermission[];
}

export interface WorkspaceRepository {
  getMemberRole(workspaceId: string, userId: string): Promise<string | null>;
  getMemberAuthorization?(workspaceId: string, userId: string): Promise<WorkspaceAuthorization | null>;
  getMembers(workspaceId: string): Promise<WorkspaceMembership[]>;
  setMemberRole(workspaceId: string, userId: string, role: string): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
}
