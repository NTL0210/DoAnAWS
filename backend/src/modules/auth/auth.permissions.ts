import type { WorkspaceRole } from "./auth.types.js";

export const WORKSPACE_PERMISSIONS = [
  "workspace.view",
  "workspace.manage",
  "workspace.delete",
  "channels.create",
  "channels.delete",
  "channels.manage",
  "members.view",
  "members.invite",
  "members.remove",
  "roles.manage",
  "roles.view",
  "teams.create",
  "teams.manage",
  "teams.delete",
  "teams.view",
  "tasks.create",
  "tasks.assign",
  "tasks.delete",
  "tasks.manage_all",
  "tasks.view",
  "tasks.update_status",
  "tasks.comment",
  "tasks.approve",
  "meetings.create",
  "meetings.record",
  "meetings.manage",
  "meetings.join",
  "voice.record",
  "voice.manage",
  "chat.send",
  "chat.upload",
  "analytics.view",
  "reports.view",
  "profile.view",
] as const;

export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];

const EMPLOYEE_PERMISSIONS: WorkspacePermission[] = [
  "workspace.view",
  "members.view",
  "teams.view",
  "tasks.view",
  "tasks.update_status",
  "tasks.comment",
  "meetings.join",
  "chat.send",
  "chat.upload",
  "profile.view",
];

export const BUILT_IN_ROLE_PERMISSIONS: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  OWNER: WORKSPACE_PERMISSIONS,
  ADMIN: WORKSPACE_PERMISSIONS,
  VICE_ADMIN: WORKSPACE_PERMISSIONS.filter((permission) =>
    !["workspace.delete"].includes(permission),
  ),
  MANAGER: [
    ...EMPLOYEE_PERMISSIONS,
    "channels.create",
    "channels.manage",
    "members.invite",
    "teams.create",
    "teams.manage",
    "tasks.create",
    "tasks.assign",
    "tasks.delete",
    "tasks.manage_all",
    "meetings.create",
    "meetings.record",
    "meetings.manage",
    "voice.record",
    "voice.manage",
    "analytics.view",
    "reports.view",
  ],
  MEMBER: EMPLOYEE_PERMISSIONS,
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
};

export function getBuiltInRolePermissions(role: WorkspaceRole): WorkspacePermission[] {
  return [...BUILT_IN_ROLE_PERMISSIONS[role]];
}
