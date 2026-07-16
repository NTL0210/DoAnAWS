export type MeetingStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "AI_REVIEW_READY"
  | "TASKS_GENERATED"
  | "COMPLETED"
  | "FAILED";

export interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  assignee?: string | undefined;
  teamId?: string | null | undefined;
  startDate?: string | null | undefined;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadline: string | null;
  confidence: number;
  approved?: boolean | undefined;
  sourceQuote?: string | undefined;
  reason?: string | undefined;
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
  deletedAt?: string | undefined;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingInput {
  workspaceId: string;
  teamId?: string | undefined;
  title?: string | undefined;
  transcriptText?: string | undefined;
  storageRef?: string | undefined;
  createdBy?: string | undefined;
}

export interface UpdateMeetingInput {
  title?: string | undefined;
  status?: MeetingStatus | undefined;
  summary?: string | undefined;
  storageRef?: string | undefined;
  transcriptText?: string | undefined;
  keyDecisions?: string[] | undefined;
  risks?: string[] | undefined;
  actionItems?: string[] | undefined;
  suggestedTasks?: SuggestedTask[] | undefined;
  generatedTaskIds?: string[] | undefined;
  expectedVersion?: number | undefined;
}
