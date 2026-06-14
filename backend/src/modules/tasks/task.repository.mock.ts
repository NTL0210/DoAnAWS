import { ConflictError } from "../../shared/errors/app-error.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { TaskRepository } from "./task.repository.js";
import type { Task } from "./task.types.js";

const seed: Task[] = [
  {
    id: "task-1",
    workspaceId: "ws-1",
    meetingId: "meet-1",
    sourceMeetingId: "meet-1",
    title: "Implement form validation for login page",
    description: "Create reusable form validation components.",
    assigneeId: "emp-3",
    createdBy: "emp-2",
    priority: "HIGH",
    status: "IN_PROGRESS",
    progress: 60,
    deadline: "2026-06-05",
    generatedFromAI: false,
    aiConfidence: null,
    version: 1,
    createdAt: "2026-05-21T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z"
  }
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MockTaskRepository implements TaskRepository {
  private readonly items = new Map<string, Task>();

  constructor(initial: Task[] = seed) {
    for (const task of initial) this.items.set(task.id, clone(task));
  }

  async getById(params: {
    workspaceId: string;
    taskId: string;
  }): Promise<Task | null> {
    const task = this.items.get(params.taskId);
    if (!task || task.workspaceId !== params.workspaceId) return null;
    return clone(task);
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
    assigneeId?: string | undefined;
    meetingId?: string | undefined;
  }): Promise<PaginatedResult<Task>> {
    const offset = params.nextToken ? Number(params.nextToken) : 0;
    const all = [...this.items.values()]
      .filter((item) => item.workspaceId === params.workspaceId)
      .filter((item) => !params.assigneeId || item.assigneeId === params.assigneeId)
      .filter((item) => !params.meetingId || item.sourceMeetingId === params.meetingId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const nextOffset = offset + params.limit;
    return {
      items: all.slice(offset, nextOffset).map(clone),
      nextToken: nextOffset < all.length ? String(nextOffset) : undefined
    };
  }

  async create(task: Task): Promise<void> {
    if (this.items.has(task.id)) throw new ConflictError("Task already exists");
    this.items.set(task.id, clone(task));
  }

  async update(task: Task, expectedVersion: number): Promise<void> {
    const current = this.items.get(task.id);
    if (!current) return;
    if (current.version !== expectedVersion) {
      throw new ConflictError("Task version conflict");
    }
    this.items.set(task.id, clone(task));
  }

  async batchCreate(tasks: Task[]): Promise<void> {
    for (const task of tasks) await this.create(task);
  }

  async createManyForMeetingTransaction(params: {
    workspaceId: string;
    meetingId: string;
    tasks: Task[];
  }): Promise<void> {
    for (const task of params.tasks) {
      if (task.workspaceId !== params.workspaceId || task.sourceMeetingId !== params.meetingId) {
        throw new ConflictError("Task does not belong to requested meeting");
      }
    }
    await this.batchCreate(params.tasks);
  }
}
