export type AuditAction =
  | "MEETING.CREATED"
  | "MEETING.UPDATED"
  | "TASK.CREATED"
  | "TASK.UPDATED"
  | "TASK.DELETED"
  | "USER.CREATED"
  | "USER.UPDATED"
  | "MEMBER.ADDED"
  | "MEMBER.REMOVED"
  | "ACCESS_DENIED"
  | "WORKSPACE.CREATED"
  | "WORKSPACE.UPDATED";

export interface AuditEvent {
  id: string;
  workspaceId: string;
  action: AuditAction;
  performedBy: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown> | undefined;
  createdAt: string;
}
