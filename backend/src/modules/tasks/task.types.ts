export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Task {
  id: string;
  workspaceId: string;
  meetingId: string | null;
  sourceMeetingId: string | null;
  title: string;
  description: string;
  assigneeId: string | null;
  createdBy: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  deadline: string | null;
  generatedFromAI: boolean;
  aiConfidence: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  workspaceId: string;
  meetingId?: string | undefined;
  title: string;
  description?: string | undefined;
  assigneeId?: string | undefined;
  createdBy?: string | undefined;
  priority?: TaskPriority | undefined;
  deadline?: string | undefined;
}

export interface UpdateTaskInput {
  title?: string | undefined;
  status?: TaskStatus | undefined;
  progress?: number | undefined;
  assigneeId?: string | null | undefined;
  expectedVersion: number;
}
