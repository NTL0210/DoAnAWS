export type WorkspaceRole = "OWNER" | "VICE_ADMIN" | "MANAGER" | "EMPLOYEE";

export interface WorkspaceCustomRole {
  id: string;
  name: string;
  description: string;
  color: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  userId: string;
  role: string;
  joinedAt: string;
  nickname: string | null;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
}

export interface WorkspaceChannel {
  id: string;
  workspaceId?: string;
  name: string;
  type: "text" | "voice";
  description?: string;
  isDefault?: boolean;
  scope?: string;
  teamId?: string | null;
  allowedTeamIds?: string[];
  allowedUserIds?: string[];
  deniedUserIds?: string[];
  isLocked?: boolean;
  allowRecording?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceTeam {
  id: string;
  name: string;
  description?: string;
  color?: string;
  managerId?: string;
  memberIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  workspaceType: string;
  visibility: string;
  slug: string;
  ownerId: string;
  memberIds: string[];
  members: WorkspaceMember[];
  channels: WorkspaceChannel[];
  teams: WorkspaceTeam[];
  tasks: string[];
  meetings: string[];
  messages: Record<string, unknown>;
  notifications: string[];
  invitations: string[];
  voiceRecords: string[];
  customRoles: WorkspaceCustomRole[];
  features: unknown[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspaceInput {
  name: string;
  ownerId: string;
  description?: string;
  iconColor?: string;
  workspaceType?: string;
  visibility?: string;
  members?: WorkspaceMember[];
  channels?: WorkspaceChannel[];
  teams?: WorkspaceTeam[];
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  iconColor?: string;
  visibility?: string;
  channels?: WorkspaceChannel[];
  teams?: WorkspaceTeam[];
  members?: WorkspaceMember[];
  messages?: Record<string, unknown>;
  voiceRecords?: string[];
  customRoles?: WorkspaceCustomRole[];
  expectedVersion: number;
}
