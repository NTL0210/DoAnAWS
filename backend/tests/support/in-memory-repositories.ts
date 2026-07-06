import { ConflictError } from "../../src/shared/errors/app-error.js";
import type { PaginatedResult } from "../../src/shared/types/pagination.js";
import type { AuditRepository } from "../../src/modules/audit/audit.repository.js";
import type { AuditEvent } from "../../src/modules/audit/audit.types.js";
import type { MeetingRepository } from "../../src/modules/meetings/meeting.repository.js";
import type { Meeting } from "../../src/modules/meetings/meeting.types.js";
import type { TaskRepository } from "../../src/modules/tasks/task.repository.js";
import type { Task } from "../../src/modules/tasks/task.types.js";

function page<T>(items: T[], limit: number, nextToken?: string): PaginatedResult<T> {
  const start = nextToken ? Number.parseInt(nextToken, 10) : 0;
  const slice = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : undefined;
  return { items: slice, nextToken: next };
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly entries: AuditEvent[] = [];

  async create(event: AuditEvent): Promise<void> {
    this.entries.push(event);
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<AuditEvent>> {
    return page(
      this.entries.filter((event) => event.workspaceId === params.workspaceId),
      params.limit,
      params.nextToken,
    );
  }
}

export class InMemoryMeetingRepository implements MeetingRepository {
  private readonly entries = new Map<string, Meeting>();

  constructor(initial: Meeting[] = []) {
    for (const meeting of initial) {
      this.entries.set(this.key(meeting.workspaceId, meeting.id), meeting);
    }
  }

  async getById(params: {
    workspaceId: string;
    meetingId: string;
  }): Promise<Meeting | null> {
    return this.entries.get(this.key(params.workspaceId, params.meetingId)) ?? null;
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<Meeting>> {
    const items = Array.from(this.entries.values()).filter(
      (meeting) => meeting.workspaceId === params.workspaceId,
    );
    return page(items, params.limit, params.nextToken);
  }

  async create(meeting: Meeting): Promise<void> {
    this.entries.set(this.key(meeting.workspaceId, meeting.id), meeting);
  }

  async update(meeting: Meeting, expectedVersion: number): Promise<void> {
    const key = this.key(meeting.workspaceId, meeting.id);
    const current = this.entries.get(key);
    if (!current || current.version !== expectedVersion) {
      throw new ConflictError("Meeting version conflict");
    }
    this.entries.set(key, meeting);
  }

  async batchGetByIds(params: {
    workspaceId: string;
    meetingIds: string[];
  }): Promise<Meeting[]> {
    return params.meetingIds
      .map((meetingId) => this.entries.get(this.key(params.workspaceId, meetingId)))
      .filter((meeting): meeting is Meeting => Boolean(meeting));
  }

  private key(workspaceId: string, meetingId: string): string {
    return `${workspaceId}:${meetingId}`;
  }
}

export class InMemoryTaskRepository implements TaskRepository {
  private readonly entries = new Map<string, Task>();

  constructor(initial: Task[] = []) {
    for (const task of initial) {
      this.entries.set(this.key(task.workspaceId, task.id), task);
    }
  }

  async getById(params: { workspaceId: string; taskId: string }): Promise<Task | null> {
    return this.entries.get(this.key(params.workspaceId, params.taskId)) ?? null;
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
    assigneeId?: string | undefined;
    meetingId?: string | undefined;
  }): Promise<PaginatedResult<Task>> {
    const items = Array.from(this.entries.values()).filter((task) => {
      if (task.workspaceId !== params.workspaceId) return false;
      if (params.assigneeId && task.assigneeId !== params.assigneeId) return false;
      if (params.meetingId && task.meetingId !== params.meetingId) return false;
      return true;
    });
    return page(items, params.limit, params.nextToken);
  }

  async create(task: Task): Promise<void> {
    this.entries.set(this.key(task.workspaceId, task.id), task);
  }

  async update(task: Task, expectedVersion: number): Promise<void> {
    const key = this.key(task.workspaceId, task.id);
    const current = this.entries.get(key);
    if (!current || current.version !== expectedVersion) {
      throw new ConflictError("Task version conflict");
    }
    this.entries.set(key, task);
  }

  async batchCreate(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.create(task);
    }
  }

  async createManyForMeetingTransaction(params: {
    workspaceId: string;
    meetingId: string;
    tasks: Task[];
  }): Promise<void> {
    for (const task of params.tasks) {
      this.entries.set(this.key(params.workspaceId, task.id), {
        ...task,
        workspaceId: params.workspaceId,
        meetingId: params.meetingId,
        sourceMeetingId: params.meetingId,
      });
    }
  }

  private key(workspaceId: string, taskId: string): string {
    return `${workspaceId}:${taskId}`;
  }
}
