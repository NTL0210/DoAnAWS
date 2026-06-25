import type { WorkspaceMembership, WorkspaceRole } from "./auth.types.js";

export interface WorkspaceRepository {
  getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null>;
  getMembers(workspaceId: string): Promise<WorkspaceMembership[]>;
  setMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
}
