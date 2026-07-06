import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { VoiceRecording } from "./voice-recording.types.js";

export interface VoiceRecordingRepository {
  getById(id: string): Promise<VoiceRecording | null>;
  listByChannel(params: {
    workspaceId: string;
    channelId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<VoiceRecording>>;
  create(recording: VoiceRecording): Promise<void>;
  update(recording: VoiceRecording): Promise<void>;
}
