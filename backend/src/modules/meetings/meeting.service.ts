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
      transcriptText: input.patch.transcriptText ?? current.transcriptText,
      summary: input.patch.summary ?? current.summary,
      keyDecisions: input.patch.keyDecisions ?? current.keyDecisions,
      risks: input.patch.risks ?? current.risks,
      actionItems: input.patch.actionItems ?? current.actionItems,
      suggestedTasks: input.patch.suggestedTasks ?? current.suggestedTasks,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.update(updated, input.patch.expectedVersion);
    return updated;
  }

  async process(input: { workspaceId: string; meetingId: string }): Promise<Meeting> {
    const current = await this.get(input);
    const analysis = extractMeetingWork(current.transcriptText);
    const updated: Meeting = {
      ...current,
      status: "AI_REVIEW_READY",
      summary: analysis.summary,
      actionItems: analysis.actionItems,
      suggestedTasks: analysis.suggestedTasks,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.update(updated, current.version);
    return updated;
  }
}

function extractMeetingWork(transcriptText: string): {
  summary: string;
  actionItems: string[];
  suggestedTasks: Meeting["suggestedTasks"];
} {
  const sentences = transcriptText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const summary = sentences.length > 0
    ? sentences.slice(0, 3).join(" ")
    : "No transcript text was provided for this meeting.";

  const actionItems = sentences.filter((sentence) =>
    /\b(action|follow up|todo|task|need to|needs to|must|should|will|prepare|review|finish|send|create|update|fix)\b/i.test(sentence),
  );

  const selected = (actionItems.length > 0 ? actionItems : sentences).slice(0, 5);
  const suggestedTasks = selected.map((sentence, index) => ({
    id: `suggestion-${index + 1}`,
    title: toTaskTitle(sentence),
    description: sentence,
    assigneeId: null,
    priority: inferPriority(sentence),
    deadline: null,
    confidence: actionItems.includes(sentence) ? 0.72 : 0.45,
    sourceQuote: sentence
  }));

  return { summary, actionItems, suggestedTasks };
}

function toTaskTitle(sentence: string): string {
  return sentence
    .replace(/^[A-Za-z ]+:\s*/, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function inferPriority(sentence: string): "LOW" | "MEDIUM" | "HIGH" {
  if (/\b(urgent|critical|blocked|must|asap)\b/i.test(sentence)) return "HIGH";
  if (/\b(nice to have|later|optional)\b/i.test(sentence)) return "LOW";
  return "MEDIUM";
}
