export type VoiceRecordingStatus =
  | "CREATED"
  | "UPLOAD_REQUESTED"
  | "READY"
  | "PROCESSING"
  | "AI_REVIEW_READY"
  | "FAILED"
  | "DELETED";

export interface VoiceRecording {
  id: string;
  workspaceId: string;
  channelId: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
  storageKey: string | null;
  status: VoiceRecordingStatus;
  aiStatus: "NOT_SENT" | "PROCESSING" | "COMPLETED" | "FAILED";
  meetingId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | undefined;
}

export interface CreateVoiceRecordingInput {
  workspaceId: string;
  channelId: string;
  title?: string | undefined;
  fileName?: string | undefined;
  mimeType?: string | undefined;
  sizeBytes?: number | undefined;
  durationSeconds?: number | undefined;
  createdBy: string;
}
