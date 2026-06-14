import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../shared/errors/app-error.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { TaskRepository } from "./task.repository.js";
import type { CreateTaskInput, Task, UpdateTaskInput } from "./task.types.js";

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  async list(input: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
    assigneeId?: string | undefined;
    meetingId?: string | undefined;
  }): Promise<PaginatedResult<Task>> {
    return this.repository.listByWorkspace(input);
  }

  async get(input: { workspaceId: string; taskId: string }): Promise<Task> {
    const task = await this.repository.getById(input);
    if (!task) throw new NotFoundError("Task not found");
    return task;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      meetingId: input.meetingId ?? null,
      sourceMeetingId: input.meetingId ?? null,
      title: input.title.trim(),
      description: input.description ?? "",
      assigneeId: input.assigneeId ?? null,
      createdBy: input.createdBy ?? null,
      priority: input.priority ?? "MEDIUM",
      status: "PENDING",
      progress: 0,
      deadline: input.deadline ?? null,
      generatedFromAI: false,
      aiConfidence: null,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    await this.repository.create(task);
    return task;
  }

  async update(input: {
    workspaceId: string;
    taskId: string;
    patch: UpdateTaskInput;
  }): Promise<Task> {
    const current = await this.get({
      workspaceId: input.workspaceId,
      taskId: input.taskId
    });
    const nextStatus = input.patch.status ?? current.status;
    const nextProgress =
      nextStatus === "COMPLETED" ? 100 : (input.patch.progress ?? current.progress);
    const updated: Task = {
      ...current,
      title: input.patch.title ?? current.title,
      status: nextStatus,
      progress: nextProgress,
      assigneeId:
        input.patch.assigneeId === undefined
          ? current.assigneeId
          : input.patch.assigneeId,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.update(updated, input.patch.expectedVersion);
    return updated;
  }
}
