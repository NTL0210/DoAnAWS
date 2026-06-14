import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../shared/errors/app-error.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { MeetingRepository } from "./meeting.repository.js";
import type {
  CreateMeetingInput,
  Meeting,
  UpdateMeetingInput
} from "./meeting.types.js";

export class MeetingService {
  constructor(private readonly repository: MeetingRepository) {}

  async list(input: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<Meeting>> {
    return this.repository.listByWorkspace(input);
  }

  async get(input: { workspaceId: string; meetingId: string }): Promise<Meeting> {
    const meeting = await this.repository.getById(input);
    if (!meeting) throw new NotFoundError("Meeting not found");
    return meeting;
  }

  async create(input: CreateMeetingInput): Promise<Meeting> {
    const now = new Date().toISOString();
    const meeting: Meeting = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      teamId: input.teamId ?? null,
      title: input.title.trim(),
      status: "UPLOADED",
      transcriptText: input.transcriptText ?? "",
      summary: "",
      keyDecisions: [],
      risks: [],
      actionItems: [],
      suggestedTasks: [],
      generatedTaskIds: [],
      storageRef: input.storageRef ?? null,
      version: 1,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now
    };
    await this.repository.create(meeting);
    return meeting;
  }

  async update(input: {
    workspaceId: string;
    meetingId: string;
    patch: UpdateMeetingInput;
  }): Promise<Meeting> {
    const current = await this.get({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId
    });
    const updated: Meeting = {
      ...current,
      title: input.patch.title ?? current.title,
      status: input.patch.status ?? current.status,
      summary: input.patch.summary ?? current.summary,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.update(updated, input.patch.expectedVersion);
    return updated;
  }
}
