import { ConflictError } from "../../shared/errors/app-error.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { MeetingRepository } from "./meeting.repository.js";
import type { Meeting } from "./meeting.types.js";

const seed: Meeting[] = [
  {
    id: "meeting-ai-1",
    workspaceId: "ws-1",
    teamId: "team-3",
    title: "AI Meeting Review Flow Kickoff",
    status: "AI_REVIEW_READY",
    transcriptText:
      "Alex: We need a review step before creating AI tasks. John: I can polish the suggested task card by Friday.",
    summary:
      "The team aligned on manager review before AI-created tasks are published.",
    keyDecisions: ["AI must not create tasks without manager approval."],
    risks: ["Low confidence suggestions need clear warnings."],
    actionItems: ["Build suggested task cards with edit controls."],
    suggestedTasks: [],
    generatedTaskIds: [],
    storageRef: null,
    version: 1,
    createdBy: "user-1",
    createdAt: "2026-06-06T09:00:00.000Z",
    updatedAt: "2026-06-06T09:05:00.000Z"
  }
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MockMeetingRepository implements MeetingRepository {
  private readonly items = new Map<string, Meeting>();

  constructor(initial: Meeting[] = seed) {
    for (const meeting of initial) {
      this.items.set(meeting.id, clone(meeting));
    }
  }

  async getById(params: {
    workspaceId: string;
    meetingId: string;
  }): Promise<Meeting | null> {
    const meeting = this.items.get(params.meetingId);
    if (!meeting || meeting.workspaceId !== params.workspaceId) return null;
    return clone(meeting);
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<Meeting>> {
    const offset = params.nextToken ? Number(params.nextToken) : 0;
    const all = [...this.items.values()]
      .filter((item) => item.workspaceId === params.workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = all.slice(offset, offset + params.limit).map(clone);
    const nextOffset = offset + params.limit;
    return {
      items: page,
      nextToken: nextOffset < all.length ? String(nextOffset) : undefined
    };
  }

  async create(meeting: Meeting): Promise<void> {
    if (this.items.has(meeting.id)) {
      throw new ConflictError("Meeting already exists");
    }
    this.items.set(meeting.id, clone(meeting));
  }

  async update(meeting: Meeting, expectedVersion: number): Promise<void> {
    const current = this.items.get(meeting.id);
    if (!current) return;
    if (current.version !== expectedVersion) {
      throw new ConflictError("Meeting version conflict");
    }
    this.items.set(meeting.id, clone(meeting));
  }

  async batchGetByIds(params: {
    workspaceId: string;
    meetingIds: string[];
  }): Promise<Meeting[]> {
    return params.meetingIds
      .map((id) => this.items.get(id))
      .filter((item): item is Meeting => Boolean(item))
      .filter((item) => item.workspaceId === params.workspaceId)
      .map(clone);
  }
}
