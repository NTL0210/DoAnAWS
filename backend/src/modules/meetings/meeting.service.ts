import { randomUUID } from "node:crypto";
import { logger } from "../../infrastructure/observability/logger.js";
import { NotFoundError } from "../../shared/errors/app-error.js";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { MeetingRepository } from "./meeting.repository.js";
import type {
  CreateMeetingInput,
  Meeting,
  UpdateMeetingInput
} from "./meeting.types.js";
import { createMeetingUploadUrl, mimeTypeForStorageKey } from "./meeting.upload.js";
import { analyzeStoredAudio, analyzeTranscriptText } from "../voice-recordings/voice-recording.ai.js";

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
      title: normalizeMeetingTitle(input.title, input.transcriptText, input.storageRef),
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
      storageRef: input.patch.storageRef ?? current.storageRef,
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

  async delete(input: { workspaceId: string; meetingId: string }): Promise<void> {
    const current = await this.get(input);
    await this.repository.update({
      ...current,
      deletedAt: new Date().toISOString(),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    }, current.version);
  }

  async createUpload(input: {
    workspaceId: string;
    meetingId: string;
    fileName: string;
    contentType?: string | undefined;
  }): Promise<{
    uploadUrl: string;
    storageKey: string;
    bucket: string;
    meeting: Meeting;
  }> {
    const current = await this.get({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
    });
    const upload = await createMeetingUploadUrl({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      fileName: input.fileName,
      contentType: input.contentType || "application/octet-stream",
    });
    const updated = await this.update({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      patch: {
        storageRef: upload.storageKey,
        expectedVersion: current.version,
      },
    });
    return { ...upload, meeting: updated };
  }

  async process(input: { workspaceId: string; meetingId: string }): Promise<Meeting> {
    const current = await this.get(input);
    let analysis: Awaited<ReturnType<typeof analyzeTranscriptMeeting>>;
    try {
      analysis = current.transcriptText.trim()
        ? await analyzeTranscriptMeeting(current.transcriptText, current.createdAt)
        : await analyzeStoredMeeting(current);
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err), meetingId: current.id }, "[MeetingService.process] AI processing failed");
      const failed: Meeting = {
        ...current,
        status: "FAILED",
        summary: "AI processing failed before the audio could be transcribed. Please check that the audio file finished uploading and try again.",
        keyDecisions: [],
        risks: [],
        actionItems: [],
        suggestedTasks: [],
        version: current.version + 1,
        updatedAt: new Date().toISOString()
      };
      await this.repository.update(failed, current.version);
      return failed;
    }
    const updated: Meeting = {
      ...current,
      status: "AI_REVIEW_READY",
      transcriptText: analysis.transcriptText ?? current.transcriptText,
      summary: analysis.summary,
      keyDecisions: analysis.keyDecisions ?? current.keyDecisions,
      risks: analysis.risks ?? current.risks,
      actionItems: analysis.actionItems,
      suggestedTasks: analysis.suggestedTasks,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.update(updated, current.version);
    return updated;
  }
}

async function analyzeTranscriptMeeting(transcriptText: string, referenceDate?: string): Promise<{
  summary: string;
  actionItems: string[];
  keyDecisions: string[];
  risks: string[];
  suggestedTasks: Meeting["suggestedTasks"];
  transcriptText: string;
}> {
  try {
    const analysis = await analyzeTranscriptText(transcriptText, { referenceDate });
    return {
      transcriptText: analysis.transcript || transcriptText,
      summary: analysis.summary,
      actionItems: analysis.actionItems,
      keyDecisions: analysis.keyDecisions,
      risks: analysis.risks,
      suggestedTasks: analysis.tasks.slice(0, 10).map((task, index) => ({
        id: `text-suggestion-${index + 1}`,
        title: task.title || `Task ${index + 1}`,
        description: task.description || task.title || "",
        assignee: task.assignee || "",
        assigneeId: null,
        priority: normalizePriority(task.priority),
        deadline: task.deadline || null,
        confidence: 0.78,
        ...(task.sourceQuote || task.description || task.title ? { sourceQuote: task.sourceQuote || task.description || task.title } : {}),
        ...(task.reason ? { reason: task.reason } : {}),
      })),
    };
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : String(err) }, "[analyzeTranscriptMeeting] Gemini AI analysis failed — falling back to local extraction");
    return extractMeetingWork(transcriptText);
  }
}

async function analyzeStoredMeeting(meeting: Meeting): Promise<{
  summary: string;
  actionItems: string[];
  keyDecisions: string[];
  risks: string[];
  suggestedTasks: Meeting["suggestedTasks"];
  transcriptText: string;
}> {
  if (!meeting.storageRef) {
    return {
      ...extractMeetingWork(""),
      keyDecisions: [],
      risks: [],
      transcriptText: "",
    };
  }
  const analysis = await analyzeStoredAudio({
    storageKey: meeting.storageRef,
    mimeType: mimeTypeForStorageKey(meeting.storageRef),
    referenceDate: meeting.createdAt,
  });
  return {
    transcriptText: analysis.transcript,
    summary: analysis.summary,
    actionItems: analysis.actionItems,
    keyDecisions: analysis.keyDecisions,
    risks: analysis.risks,
    suggestedTasks: analysis.tasks.slice(0, 10).map((task, index) => ({
      id: `meeting-suggestion-${index + 1}`,
      title: task.title || `Task ${index + 1}`,
      description: task.description || task.title || "",
      assignee: task.assignee || "",
      assigneeId: null,
      priority: normalizePriority(task.priority),
      deadline: task.deadline || null,
      confidence: 0.72,
      ...(task.sourceQuote || task.description || task.title ? { sourceQuote: task.sourceQuote || task.description || task.title } : {}),
      ...(task.reason ? { reason: task.reason } : {}),
    })),
  };
}

function extractMeetingWork(transcriptText: string): {
  summary: string;
  actionItems: string[];
  keyDecisions: string[];
  risks: string[];
  transcriptText: string;
  suggestedTasks: Meeting["suggestedTasks"];
} {
  const sentences = transcriptText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const summary = summarizeLocally(sentences);

  // Match both English and Vietnamese action keywords
  const actionItems = sentences.filter((sentence) =>
    /\b(action|follow up|todo|task|need to|needs to|must|should|will|prepare|review|finish|send|create|update|fix)\b/i.test(sentence)
    || /(cần|cần phải|phải|hãy|nhờ|yêu cầu|giao cho|chịu trách nhiệm|follow.?up|check|làm|chuẩn bị|báo cáo|hỏi|gọi|thông báo|liên hệ|xử lý|hoàn thành|deadline|chốt|việc cần làm)/i.test(sentence)
  );

  const normalizedActionItems = sentences.filter((sentence) => hasActionSignal(sentence));
  const selectedActionItems = normalizedActionItems.length ? normalizedActionItems : actionItems;
  const keyDecisions = sentences.filter((sentence) => hasDecisionSignal(sentence)).slice(0, 6);
  const risks = sentences.filter((sentence) => hasRiskSignal(sentence)).slice(0, 6);
  const selected = selectedActionItems.slice(0, 10);
  const suggestedTasks = selected.map((sentence, index) => ({
    id: `suggestion-${index + 1}`,
    title: toTaskTitle(sentence),
    description: sentence,
    assignee: inferAssigneeName(sentence),
    assigneeId: null,
    priority: inferPriority(sentence),
    deadline: null,
    confidence: selectedActionItems.includes(sentence) ? 0.72 : 0.45,
    sourceQuote: sentence,
    reason: "Detected action wording in transcript"
  }));

  return { summary, actionItems: selectedActionItems, keyDecisions, risks, transcriptText, suggestedTasks };
}

function normalizeMeetingTitle(title?: string, transcriptText?: string, storageRef?: string): string {
  const explicit = title?.trim();
  if (explicit) return explicit.slice(0, 200);
  const firstLine = transcriptText?.split(/\n+/).map((line) => line.trim()).find(Boolean);
  if (firstLine) return toTaskTitle(firstLine).slice(0, 80) || "AI Meeting Review";
  const fileName = storageRef?.split("/").pop();
  return fileName ? `AI Review - ${fileName.slice(0, 80)}` : "AI Meeting Review";
}

function summarizeLocally(sentences: string[]): string {
  if (sentences.length === 0) return "No transcript text was provided for this meeting.";
  const themes = inferThemes(sentences);
  const actions = sentences.filter((sentence) => hasActionSignal(sentence)).slice(0, 4).map(toTaskTitle);
  if (themes.length || actions.length) {
    return `Cuoc hop ghi nhan cac chu de chinh: ${themes.length ? themes.join(", ") : "cong viec can theo doi"}. Cac viec can xu ly tiep theo gom: ${actions.length ? actions.join("; ") : "review lai noi dung va tao task phu hop"}.`;
  }
  return `Cuoc hop co ${sentences.length} y noi dung. AI fallback da trich xuat cac dau viec kha dung de owner/admin/manager review truoc khi tao task.`;
}

function toTaskTitle(sentence: string): string {
  return sentence
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^[A-Za-zÀ-ỹ ]+:\s*/, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function inferPriority(sentence: string): "LOW" | "MEDIUM" | "HIGH" {
  const text = normalizeText(sentence);
  if (/\b(urgent|critical|blocked|must|asap|vip|tre|phan nan|bug|token|credit|chay|deadline|bao tri|cao|het)\b/i.test(text)) return "HIGH";
  if (/\b(nice to have|later|optional|sprint sau)\b/i.test(text)) return "LOW";
  return "MEDIUM";
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasActionSignal(sentence: string): boolean {
  if (isNoWorkStatement(sentence)) return false;
  const text = normalizeText(sentence);
  return /\b(action|follow up|todo|task|need|needs|must|should|will|prepare|review|finish|send|create|update|fix|call|ask|notify|demo)\b/i.test(text)
    || /\b(can|phai|truoc|deadline|chuan bi|thong bao|check|goi|lam|bao cao|xu ly|hoan thanh|chot|cap|set|doi|viet|nghien cuu|ping|gui)\b/.test(text)
    || /\bhoi\s+(gia|y kien|vendor|sep|s3|quyen|khach|doi tac)\b/.test(text);
}

function hasDecisionSignal(sentence: string): boolean {
  if (isNoWorkStatement(sentence)) return false;
  const text = normalizeText(sentence);
  return /\b(chot|quyet dinh|giu|tam dung|doi het|uu tien|de sprint sau|tap trung|decided|keep|pause|prioritize|defer|focus)\b/.test(text);
}

function hasRiskSignal(sentence: string): boolean {
  if (isNoWorkStatement(sentence)) return false;
  const text = normalizeText(sentence);
  return /\b(rui ro|tre|phan nan|het|cat|cao|anh huong|loi|bug|token|credit|chay|bao tri|tang|risk|late|delay|complain|blocked|issue|quota|maintenance|increase)\b/.test(text);
}

function isNoWorkStatement(sentence: string): boolean {
  const text = normalizeText(sentence);
  return /\b(khong co|khong thay|khong phat sinh|chua co)\b.*\b(cong viec|nhiem vu|task|action item|viec can lam|quyet dinh|deadline|ke hoach|rui ro)\b/.test(text)
    || /\b(no|not any|none|without)\b.*\b(task|action item|work item|decision|deadline|risk|assignment)\b/.test(text);
}

function inferThemes(sentences: string[]): string[] {
  const joined = normalizeText(sentences.join(" "));
  const themes: string[] = [];
  if (/(marketing|campaign|ads|facebook|tiktok|google)/.test(joined)) themes.push("campaign va kenh marketing");
  if (/(vip|khach|don hang|sales)/.test(joined)) themes.push("khach hang va don hang");
  if (/(vendor|bao bi|in an|gia giay)/.test(joined)) themes.push("vendor va chi phi bao bi");
  if (/(hop dong|thanh toan|singapore|phan phoi)/.test(joined)) themes.push("hop dong doi tac");
  if (/(crm|bao tri|it)/.test(joined)) themes.push("van hanh he thong CRM");
  if (/(slide|bao cao|doanh thu|ke toan)/.test(joined)) themes.push("bao cao tuan va so lieu");
  if (/(onboarding|nhan vien moi|email)/.test(joined)) themes.push("onboarding nhan su");
  if (/(login|token|cognito|auth)/.test(joined)) themes.push("dang nhap va token");
  if (/(websocket|voice|livekit|recording|s3)/.test(joined)) themes.push("chat, voice va recording");
  if (/(budget|credit|aws|dynamodb)/.test(joined)) themes.push("ha tang va chi phi AWS");
  return themes.slice(0, 7);
}

function inferAssigneeName(sentence: string): string {
  const speaker = sentence.match(/^\[([^\]]+)\]/)?.[1]?.trim();
  const direct = sentence.match(/\b(?:anh|chi|chị|em|ban|bạn)?\s*([A-ZÀ-Ỹ][\p{L}]{1,20})\s+(?:fix|review|chuan|chuẩn|cap|cấp|set|doi|đổi|viet|viết|nghien|nghiên|lam|làm|bao|báo|hoi|hỏi|goi|gọi|ping|gui|gửi)/u)?.[1];
  return direct || speaker || "";
}

function normalizePriority(value?: string): "LOW" | "MEDIUM" | "HIGH" {
  const priority = String(value || "").toUpperCase();
  if (priority === "HIGH") return "HIGH";
  if (priority === "LOW") return "LOW";
  return "MEDIUM";
}
