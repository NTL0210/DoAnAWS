import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { Task } from "./task.types.js";

export interface TaskRepository {
  getById(params: { workspaceId: string; taskId: string }): Promise<Task | null>;
  listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
    assigneeId?: string | undefined;
    meetingId?: string | undefined;
  }): Promise<PaginatedResult<Task>>;
  create(task: Task): Promise<void>;
  update(task: Task, expectedVersion: number): Promise<void>;
  batchCreate(tasks: Task[]): Promise<void>;
  createManyForMeetingTransaction(params: {
    workspaceId: string;
    meetingId: string;
    tasks: Task[];
  }): Promise<void>;
}
