export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Task {
  id: string;
  workspaceId: string;
  teamId: string | null;
  meetingId: string | null;
  sourceMeetingId: string | null;
  title: string;
  description: string;
  assigneeId: string | null;
  createdBy: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  startDate: string | null;
  deadline: string | null;
  generatedFromAI: boolean;
  aiConfidence: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  workspaceId: string;
  teamId?: string | undefined;
  meetingId?: string | undefined;
  title: string;
  description?: string | undefined;
  assigneeId?: string | undefined;
  createdBy?: string | undefined;
  priority?: TaskPriority | undefined;
  startDate?: string | undefined;
  deadline?: string | undefined;
  generatedFromAI?: boolean | undefined;
  aiConfidence?: number | undefined;
}

export interface UpdateTaskInput {
  title?: string | undefined;
  status?: TaskStatus | undefined;
  progress?: number | undefined;
  assigneeId?: string | null | undefined;
  priority?: TaskPriority | undefined;
  startDate?: string | null | undefined;
  deadline?: string | null | undefined;
  expectedVersion: number;
}
