import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../shared/errors/app-error.js";
import type { MeetingService } from "../meetings/meeting.service.js";
import type { Meeting } from "../meetings/meeting.types.js";
import { analyzeVoiceRecording, createVoiceUploadUrl } from "./voice-recording.ai.js";
import type { VoiceRecordingRepository } from "./voice-recording.repository.js";
import type { CreateVoiceRecordingInput, VoiceRecording } from "./voice-recording.types.js";

export class VoiceRecordingService {
  constructor(
    private readonly repository: VoiceRecordingRepository,
    private readonly meetingService: MeetingService,
  ) {}

  async list(input: {
    workspaceId: string;
    channelId: string;
    limit: number;
    nextToken?: string | undefined;
  }) {
    return this.repository.listByChannel(input);
  }

  async create(input: CreateVoiceRecordingInput): Promise<VoiceRecording> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const record: VoiceRecording = {
      id,
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      title: input.title?.trim() || "Voice Recording",
      fileName: input.fileName || `${id}.webm`,
      mimeType: input.mimeType || "audio/webm",
      sizeBytes: input.sizeBytes ?? 0,
      durationSeconds: input.durationSeconds ?? 0,
      storageKey: null,
      status: "CREATED",
      aiStatus: "NOT_SENT",
      meetingId: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.create(record);
    return record;
  }

  async createUpload(input: { id: string; userId: string; contentType?: string; sizeBytes?: number }) {
    const record = await this.getOwned(input.id, input.userId);
    const prepared: VoiceRecording = {
      ...record,
      mimeType: input.contentType || record.mimeType,
      sizeBytes: input.sizeBytes ?? record.sizeBytes,
      status: "UPLOAD_REQUESTED",
      updatedAt: new Date().toISOString(),
    };
    const upload = await createVoiceUploadUrl(prepared);
    await this.repository.update({ ...prepared, storageKey: upload.storageKey });
    return upload;
  }

  async markReady(input: {
    id: string;
    userId: string;
    storageKey?: string | undefined;
    status?: VoiceRecording["status"] | undefined;
    sizeBytes?: number | undefined;
  }): Promise<VoiceRecording> {
    const record = await this.getOwned(input.id, input.userId);
    const updated: VoiceRecording = {
      ...record,
      storageKey: input.storageKey || record.storageKey,
      sizeBytes: input.sizeBytes ?? record.sizeBytes,
      status: input.status || "READY",
      updatedAt: new Date().toISOString(),
    };
    await this.repository.update(updated);
    return updated;
  }

  async delete(input: { id: string; userId: string }): Promise<void> {
    const record = await this.getOwned(input.id, input.userId);
    await this.repository.update({
      ...record,
      status: "DELETED",
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async sendToAi(input: { id: string; userId: string }): Promise<{ recording: VoiceRecording; meeting: Meeting }> {
    const record = await this.getOwned(input.id, input.userId);
    if (!record.storageKey) throw new Error("Voice recording has not been uploaded");

    const processing: VoiceRecording = {
      ...record,
      status: "PROCESSING",
      aiStatus: "PROCESSING",
      updatedAt: new Date().toISOString(),
    };
    await this.repository.update(processing);

    try {
      const analysis = await analyzeVoiceRecording(processing);
      const meeting = await this.meetingService.create({
        workspaceId: processing.workspaceId,
        title: processing.title,
        transcriptText: analysis.transcript,
        storageRef: processing.storageKey || undefined,
        createdBy: processing.createdBy,
      });
      const suggestedTasks = analysis.tasks.slice(0, 10).map((task, index) => ({
        id: `voice-suggestion-${index + 1}`,
        title: task.title || `Task ${index + 1}`,
        description: task.description || task.title || "",
        assigneeId: null,
        priority: normalizePriority(task.priority),
        deadline: task.deadline || null,
        confidence: 0.72,
        ...(task.description || task.title ? { sourceQuote: task.description || task.title } : {}),
      }));
      const reviewed = await this.meetingService.update({
        workspaceId: processing.workspaceId,
        meetingId: meeting.id,
        patch: {
          status: "AI_REVIEW_READY",
          transcriptText: analysis.transcript,
          summary: analysis.summary,
          keyDecisions: analysis.keyDecisions,
          risks: analysis.risks,
          actionItems: analysis.actionItems,
          suggestedTasks,
          expectedVersion: meeting.version,
        },
      });
      const completed: VoiceRecording = {
        ...processing,
        status: "AI_REVIEW_READY",
        aiStatus: "COMPLETED",
        meetingId: meeting.id,
        updatedAt: new Date().toISOString(),
      };
      await this.repository.update(completed);
      return { recording: completed, meeting: reviewed };
    } catch (error) {
      await this.repository.update({
        ...processing,
        status: "FAILED",
        aiStatus: "FAILED",
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  private async getOwned(id: string, userId: string): Promise<VoiceRecording> {
    const record = await this.repository.getById(id);
    if (!record || record.status === "DELETED") throw new NotFoundError("Voice recording not found");
    if (record.createdBy !== userId) throw new NotFoundError("Voice recording not found");
    return record;
  }
}

function normalizePriority(value?: string): "LOW" | "MEDIUM" | "HIGH" {
  const priority = String(value || "").toUpperCase();
  if (priority === "HIGH") return "HIGH";
  if (priority === "LOW") return "LOW";
  return "MEDIUM";
}
