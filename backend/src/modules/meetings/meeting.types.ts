export type MeetingStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "AI_REVIEW_READY"
  | "COMPLETED"
  | "FAILED";

export interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  deadline: string | null;
  confidence: number;
  sourceQuote?: string;
}

export interface Meeting {
  id: string;
  workspaceId: string;
  teamId: string | null;
  title: string;
  status: MeetingStatus;
  transcriptText: string;
  summary: string;
  keyDecisions: string[];
  risks: string[];
  actionItems: string[];
  suggestedTasks: SuggestedTask[];
  generatedTaskIds: string[];
  storageRef: string | null;
  expiresAt?: number | undefined;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingInput {
  workspaceId: string;
  teamId?: string | undefined;
  title: string;
  transcriptText?: string | undefined;
  storageRef?: string | undefined;
  createdBy?: string | undefined;
}

export interface UpdateMeetingInput {
  title?: string | undefined;
  status?: MeetingStatus | undefined;
  summary?: string | undefined;
  expectedVersion: number;
}
