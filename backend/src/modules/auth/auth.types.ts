export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

export function hasSufficientRole(
  userRole: WorkspaceRole,
  requiredRole: WorkspaceRole,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export interface AuthUser {
  userId: string;
  email: string;
  systemRole: string;
  workspaceId?: string | undefined;
}

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
    departmentId: string | null;
  };
}
