import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { Meeting } from "./meeting.types.js";

export interface MeetingRepository {
  getById(params: {
    workspaceId: string;
    meetingId: string;
  }): Promise<Meeting | null>;
  listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<Meeting>>;
  create(meeting: Meeting): Promise<void>;
  update(meeting: Meeting, expectedVersion: number): Promise<void>;
  batchGetByIds(params: {
    workspaceId: string;
    meetingIds: string[];
  }): Promise<Meeting[]>;
}
