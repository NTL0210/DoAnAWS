import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import type { VoiceRecording } from "./voice-recording.types.js";

const s3 = new S3Client({ region: env.AWS_REGION });
const geminiBase = "https://generativelanguage.googleapis.com/v1beta/models";
const transcriptionResponseSchema = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
  },
  required: ["transcript"],
};
const analysisResponseSchema = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    summary: { type: "STRING" },
    keyDecisions: { type: "ARRAY", items: { type: "STRING" } },
    actionItems: { type: "ARRAY", items: { type: "STRING" } },
    risks: { type: "ARRAY", items: { type: "STRING" } },
    tasks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          assignee: { type: "STRING" },
          priority: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
          startDate: { type: "STRING" },
          deadline: { type: "STRING" },
          sourceQuote: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["title", "description", "assignee", "priority", "startDate", "deadline", "sourceQuote", "reason"],
      },
    },
  },
  required: ["transcript", "summary", "keyDecisions", "actionItems", "risks", "tasks"],
};

export interface VoiceAnalysisTask {
  title: string;
  description: string;
  assignee: string;
  priority: string;
  startDate: string;
  deadline: string;
  confidence: number;
  sourceQuote?: string;
  reason?: string;
}

interface VoiceAnalysisResult {
  transcript: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: string[];
  tasks: VoiceAnalysisTask[];
}

interface AnalysisOptions {
  referenceDate?: string | undefined;
}

type TaskCandidate = {
  title?: string | undefined;
  description?: string | undefined;
  assignee?: string | undefined;
  sourceQuote?: string | undefined;
};

export function getVoiceRecordingBucket(): string {
  const bucket = env.VOICE_RECORDINGS_BUCKET || env.AUDIO_BUCKET;
  if (!bucket) throw new Error("VOICE_RECORDINGS_BUCKET or AUDIO_BUCKET is required");
  return bucket;
}

export async function deleteStoredVoiceRecording(storageKey: string): Promise<void> {
  if (!storageKey.startsWith("voice-recordings/")) {
    throw new Error("Refusing to delete an unexpected voice recording storage key");
  }
  await s3.send(new DeleteObjectCommand({
    Bucket: getVoiceRecordingBucket(),
    Key: storageKey,
  }));
}

export async function createVoiceUploadUrl(recording: VoiceRecording): Promise<{
  uploadUrl: string;
  storageKey: string;
  bucket: string;
}> {
  const bucket = getVoiceRecordingBucket();
  const extension = extensionForMime(recording.mimeType);
  const storageKey = `voice-recordings/${recording.workspaceId}/${recording.channelId}/${recording.id}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: recording.mimeType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  return { uploadUrl, storageKey, bucket };
}

export async function createVoiceDownloadUrl(
  recording: VoiceRecording,
  options: { attachment?: boolean } = {},
): Promise<string | null> {
  if (!recording.storageKey) return null;
  const command = new GetObjectCommand({
    Bucket: getVoiceRecordingBucket(),
    Key: recording.storageKey,
    ...(options.attachment
      ? { ResponseContentDisposition: contentDisposition(recording.fileName) }
      : {}),
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

function contentDisposition(fileName: string): string {
  const safeAsciiName = (fileName || "voice-recording.webm")
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(fileName || safeAsciiName)}`;
}

export async function analyzeVoiceRecording(recording: VoiceRecording): Promise<{
  transcript: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: string[];
  tasks: Array<Partial<VoiceAnalysisTask>>;
}> {
  if (!recording.storageKey) throw new Error("Voice recording storageKey is missing");
  return analyzeStoredAudio({ storageKey: recording.storageKey, mimeType: recording.mimeType });
}

export async function analyzeStoredAudio(input: { storageKey: string; mimeType: string; referenceDate?: string | undefined }): Promise<{
  transcript: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: string[];
  tasks: Array<Partial<VoiceAnalysisTask>>;
}> {
  if (!input.storageKey) throw new Error("Audio storageKey is missing");
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

  const bucket = getVoiceRecordingBucket();
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: input.storageKey }));
  const body = response.Body;
  if (!body) throw new Error("Meeting file is empty");
  const buffer = Buffer.from(await body.transformToByteArray());
  if (buffer.length === 0) throw new Error("Meeting file is empty");

  if (isTextInput(input.mimeType, input.storageKey)) {
    return analyzeTranscriptText(decodeTranscriptBuffer(buffer), { referenceDate: input.referenceDate });
  }

  const geminiMimeType = toGeminiMimeType(input.mimeType, input.storageKey);
  const fileUri = await uploadToGemini(buffer, geminiMimeType, input.storageKey);
  try {
    const transcript = await transcribeAudioWithGemini(fileUri, geminiMimeType);
    const analysis = await analyzeTranscriptText(transcript, { referenceDate: input.referenceDate });
    // Preserve the dedicated transcript; the second pass only extracts execution data.
    return { ...analysis, transcript };
  } catch {
    // Keep the existing one-pass path available if the provider rejects a
    // dedicated transcription request.
    const raw = await callGeminiWithFile(fileUri, geminiMimeType, audioPrompt(input.referenceDate), {
      responseSchema: analysisResponseSchema,
    });
    return ensureActionableAnalysis(normalizeGeminiJson(raw), "", input.referenceDate);
  }
}

export async function analyzeTranscriptText(transcriptText: string, options: AnalysisOptions = {}): Promise<VoiceAnalysisResult> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
  const trimmed = normalizeTranscriptText(transcriptText).trim();
  if (!trimmed) return emptyAnalysis();
  const referenceDate = resolveReferenceDate(trimmed, options.referenceDate);
  const raw = await callGeminiWithText(textPrompt(trimmed, referenceDate));
  return ensureActionableAnalysis(normalizeGeminiJson(raw), trimmed, referenceDate);
}

async function uploadToGemini(fileBuffer: Buffer, mimeType: string, storageKey: string): Promise<string> {
  const startResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "X-Goog-Upload-Header-Content-Length": String(fileBuffer.length),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: {
        display_name: storageKey.split("/").pop() || "meeting-audio",
      },
    }),
  });
  if (!startResponse.ok) {
    throw new Error(`Gemini upload session failed: HTTP ${startResponse.status}`);
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini upload session missing upload URL");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(fileBuffer.length),
      "Content-Type": mimeType,
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
    },
    body: fileBuffer as unknown as BodyInit,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Gemini upload failed: HTTP ${uploadResponse.status}`);
  }
  const data = await uploadResponse.json() as { file?: { name?: string; uri?: string; state?: string } };
  if (!data.file?.uri) throw new Error("Gemini upload response missing file uri");
  if (data.file.name && data.file.state && data.file.state !== "ACTIVE") {
    await waitForGeminiFile(data.file.name);
  }
  return data.file.uri;
}

async function waitForGeminiFile(fileName: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${env.GEMINI_API_KEY}`);
    if (!response.ok) throw new Error(`Gemini file status failed: HTTP ${response.status}`);
    const data = await response.json() as { state?: string };
    if (data.state === "ACTIVE" || !data.state) return;
    if (data.state === "FAILED") throw new Error("Gemini file processing failed");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Gemini file processing timed out");
}

async function callGeminiWithFile(
  fileUri: string,
  mimeType: string,
  prompt: string,
  generation: { temperature?: number; maxOutputTokens?: number; responseSchema?: Record<string, unknown> } = {},
): Promise<string> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetchGeminiGeneration(`${geminiBase}/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { fileData: { mimeType, fileUri } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        temperature: generation.temperature ?? 0.15,
        maxOutputTokens: generation.maxOutputTokens ?? 8192,
        responseMimeType: "application/json",
        ...(generation.responseSchema ? { responseSchema: generation.responseSchema } : {}),
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API failed: HTTP ${response.status}`);
  }
  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function transcribeAudioWithGemini(fileUri: string, mimeType: string): Promise<string> {
  const raw = await callGeminiWithFile(fileUri, mimeType, transcriptionPrompt(), {
    temperature: 0,
    maxOutputTokens: 16384,
    responseSchema: transcriptionResponseSchema,
  });
  const transcript = normalizeGeminiJson(raw).transcript.trim();
  if (!transcript) throw new Error("Gemini returned an empty transcription");
  return transcript;
}

async function callGeminiWithText(prompt: string): Promise<string> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetchGeminiGeneration(`${geminiBase}/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: analysisResponseSchema,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API failed: HTTP ${response.status}`);
  }
  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function fetchGeminiGeneration(url: string, init: RequestInit): Promise<Response> {
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok || !retryableStatuses.has(response.status) || attempt === 1) return response;
    await response.body?.cancel().catch(() => {});
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(retryAfterSeconds * 1000, 3000)
      : 750;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Gemini API request failed");
}

function normalizeGeminiJson(raw: string): VoiceAnalysisResult {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  }
  if (!isRecord(parsed)) return emptyAnalysis();
  return {
    transcript: normalizeTranscriptText(stringValue(parsed.transcript)),
    summary: normalizeTranscriptText(stringValue(parsed.summary)),
    keyDecisions: stringArray(parsed.keyDecisions).map(normalizeTranscriptText),
    actionItems: stringArray(parsed.actionItems).map(normalizeTranscriptText),
    risks: stringArray(parsed.risks).map(normalizeTranscriptText),
    tasks: Array.isArray(parsed.tasks)
      ? parsed.tasks.filter(isRecord).map((task) => ({
          title: normalizeTranscriptText(stringValue(task.title)),
          description: normalizeTranscriptText(stringValue(task.description)),
          assignee: normalizeTranscriptText(stringValue(task.assignee)),
          priority: stringValue(task.priority),
          startDate: stringValue(task.startDate),
          deadline: stringValue(task.deadline),
          confidence: numberValue(task.confidence),
          sourceQuote: normalizeTranscriptText(stringValue(task.sourceQuote)),
          reason: normalizeTranscriptText(stringValue(task.reason)),
        }))
      : [],
  };
}

function emptyAnalysis(): VoiceAnalysisResult {
  return { transcript: "", summary: "", keyDecisions: [], actionItems: [], risks: [], tasks: [] };
}

function executionPromptHeader(referenceDate?: string, sourceText?: string): string {
  const language = sourceText ? detectTranscriptLanguage(sourceText) : undefined;
  return [
    "You are the execution analyst for AI Meeting Workforce Platform.",
    "The user provides only meeting notes, work notes, transcript text, or audio. Do not ask follow-up questions.",
    "Transform the content into execution: synthesized summary, decisions, risks, action items, and task suggestions.",
    language
      ? `Output language: ${language}. Keep every summary, decision, action item, task title, description, reason, and source quote in ${language}. Do not translate the input.`
      : "Output language: match the primary language spoken in the input. Do not translate the input.",
    "Keep person names exactly as spoken/written.",
    referenceDate ? `Reference date for relative deadlines: ${referenceDate}.` : "No reliable reference date is available for relative deadlines.",
    "Do not copy the transcript as the summary. The summary must be 3-6 synthesized sentences.",
    "Extract concrete work only. Ignore small talk unless it creates a risk or task.",
    "Create a task only for an explicit delegation or commitment with concrete work. Do not create tasks for questions, discussion topics, decisions, status updates, or acknowledgements.",
    "Treat explicit responsibility assignments such as 'A phu trach backend', 'B se la frontend', or 'phan cong cho A lam backend' as concrete work even when the sentence does not repeat another action verb.",
    "When one sentence assigns different responsibilities to multiple people, create one separate task per assignee. Never collapse backend and frontend ownership into one task.",
    "Read the entire transcript before deciding the final task list. Later corrections, confirmations, dependencies, and cancellations override earlier mentions.",
    "For a mid-sentence correction or a later reassignment, keep only the final corrected work and newest assignee. Never retain the superseded assignment as a second task.",
    "If several people share the exact same work item, create one task and put their names in assignee separated by commas. Do not duplicate the task.",
    "When work is assigned to a named team or group, keep that team name as assignee. Do not invent individual members. Preserve qualifiers that distinguish people with the same name, such as Duc backend versus Duc design.",
    "Group several closely related subtasks for one assignee into one task unless they have different priorities or deadlines.",
    "Deduplicate repeated confirmations of the same work for the same assignee and keep the most complete evidence.",
    "Do not create tasks from progress questions, status questions, general decisions without an owner, or personal trial intentions such as 'de em thu tinh nang nay'.",
    "If a later statement cancels or removes assigned work, omit that task from the final result.",
    "Conditional work that is not fully committed may remain a task, but state the condition in description and reason so confidence can be reduced.",
    "For dependencies and recurring work, preserve the dependency, cadence, and frequency verbatim in description and reason.",
    "Treat documentation, note-taking, ticket creation, and checking an external spec or link as valid tasks. State that external content is unavailable instead of inventing it.",
    "Keep indefinitely deferred work as a task with an empty deadline and mark the deferral clearly in description and reason.",
    "Only treat a statement as a joke when the transcript contains an explicit cue such as [cuoi] or [laughs]. If humor or STT interpretation is uncertain, preserve the uncertainty in reason and use cautious confidence.",
    "Handle Vietnamese-English code-switching normally and preserve technical English terms verbatim. If STT makes a name, number, date, or time implausible, do not guess; record the ambiguity in description and reason.",
    "For first-person Vietnamese references such as toi, minh, or em where the speaker assigns work to themselves, use the exact assignee value SELF.",
    "Keep partial names and nicknames exactly as spoken. If no assignee is supported by the transcript, use unassigned and never infer one from job role.",
    "Priority is HIGH only when the transcript says gap, khan, uu tien cao, quan trong nhat, urgent, or equivalent; LOW for khong gap or khi nao ranh; otherwise MEDIUM.",
    "Only output an ISO deadline when the transcript contains an explicit calendar date. Keep relative wording such as truoc thu Sau or trong tuan nay in sourceQuote and description without inventing a date.",
    "Before returning JSON, recount explicit assignments, apply final corrections, remove cancelled work, and verify there are no duplicate task plus assignee pairs.",
    "Every sourceQuote must be short exact evidence from the transcript. If there is no supported task in the entire transcript, return an empty tasks array without inventing work.",
    "Use startDate and deadline as YYYY-MM-DD only when the transcript states an explicit calendar date; otherwise keep them empty and preserve relative wording in description and sourceQuote.",
    "Never invent years or calendar dates that are not supported by the transcript and reference date.",
    "Return valid JSON only. No Markdown, no commentary.",
    "",
    "JSON schema:",
    "{",
    '  "transcript": "full transcript or original text",',
    '  "summary": "synthesized summary in the input language",',
    '  "keyDecisions": ["decision"],',
    '  "actionItems": ["action item"],',
    '  "tasks": [',
    "    {",
    '      "title": "specific task title",',
    '      "description": "clear task description",',
    '      "assignee": "person name if known",',
    '      "priority": "HIGH|MEDIUM|LOW",',
    '      "startDate": "YYYY-MM-DD or empty string",',
    '      "deadline": "YYYY-MM-DD or empty string",',
    '      "sourceQuote": "short evidence from transcript",',
    '      "reason": "why this is a task"',
    "    }",
    "  ],",
    '  "risks": ["risk"]',
    "}",
  ].join("\n");
}

function ensureActionableAnalysis(analysis: VoiceAnalysisResult, fallbackTranscript: string, referenceDate?: string): VoiceAnalysisResult {
  const transcript = (analysis.transcript || fallbackTranscript).trim();
  if (transcript && !hasExecutionSignal(transcript)) {
    return {
      transcript,
      summary: isUsefulSummary(analysis.summary, transcript)
        ? analysis.summary.trim()
        : noWorkSummary(transcript),
      keyDecisions: [],
      actionItems: [],
      risks: [],
      tasks: [],
    };
  }
  const local = buildLocalActionableAnalysis(transcript);
  const summary = isUsefulSummary(analysis.summary, transcript) ? analysis.summary.trim() : local.summary;
  const normalizedAiTasks = analysis.tasks
    .filter((task) => (task.title || task.description || "").trim())
    .map((task, index) => ({
      title: task.title || local.tasks[index]?.title || `Task ${index + 1}`,
      description: task.description || task.title || local.tasks[index]?.description || "",
      assignee: task.assignee || local.tasks[index]?.assignee || "",
      priority: normalizeAiPriority(task.priority || local.tasks[index]?.priority || "MEDIUM"),
      startDate: normalizeStartDate(task.startDate || local.tasks[index]?.startDate || "", task.sourceQuote || task.description || task.title || "", transcript, referenceDate),
      deadline: normalizeDeadline(task.deadline || local.tasks[index]?.deadline || "", task.sourceQuote || task.description || task.title || "", transcript, referenceDate),
      sourceQuote: task.sourceQuote || local.tasks[index]?.sourceQuote || task.description || task.title || "",
      reason: task.reason || local.tasks[index]?.reason || "Extracted from meeting content",
    }));
  const explicitResponsibilityTasks = extractExplicitResponsibilityTasks(transcript);
  const tasks = filterActionableTaskCandidates([
    ...explicitResponsibilityTasks,
    ...normalizedAiTasks,
  ], transcript).map((task) => ({
    ...task,
    confidence: calculateTaskConfidence(task, transcript),
  }));

  const localTasks = local.tasks.map((task) => ({
    ...task,
    startDate: normalizeStartDate(task.startDate, task.sourceQuote || task.description, transcript, referenceDate),
    deadline: normalizeDeadline(task.deadline, task.sourceQuote || task.description, transcript, referenceDate),
    confidence: calculateTaskConfidence(task, transcript),
  }));

  return {
    transcript,
    summary,
    keyDecisions: analysis.keyDecisions.length ? analysis.keyDecisions : local.keyDecisions,
    actionItems: analysis.actionItems.length ? analysis.actionItems : local.actionItems,
    risks: analysis.risks.length ? analysis.risks : local.risks,
    tasks: tasks.length ? tasks : localTasks,
  };
}

export function isUsefulSummary(summary: string, transcript: string): boolean {
  const cleanSummary = summary.trim();
  if (cleanSummary.length < 20) return false;
  if (!transcript.trim()) return true;
  const normalizedSummary = normalizeText(cleanSummary);
  const normalizedTranscript = normalizeText(transcript);
  if (normalizedSummary === normalizedTranscript) return false;
  if (normalizedSummary.length >= normalizedTranscript.length * 0.85 && normalizedTranscript.includes(normalizedSummary)) return false;
  const maximumUsefulLength = Math.max(240, transcript.length * 0.75);
  return cleanSummary.length <= maximumUsefulLength;
}

function noWorkSummary(transcript: string): string {
  return detectTranscriptLanguage(transcript) === "Vietnamese"
    ? "Khong phat hien dau viec can xu ly trong noi dung nay. Transcript duoc giu lai de review."
    : "No work-related action items were detected in this audio/transcript. The transcript is preserved for review.";
}

function buildLocalActionableAnalysis(transcript: string): VoiceAnalysisResult {
  if (!transcript.trim()) return emptyAnalysis();
  const language = detectTranscriptLanguage(transcript);
  const lines = transcript
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const actionableLines = lines.filter((line) => !isNoWorkStatement(line));
  const actionLines = actionableLines.filter((line) => hasActionSignal(line));
  const decisionLines = actionableLines.filter((line) => hasDecisionSignal(line)).slice(0, 6);
  const riskLines = actionableLines.filter((line) => hasRiskSignal(line)).slice(0, 6);
  const selected = actionLines.slice(0, 12);
  const tasks = filterActionableTaskCandidates(selected.map((line, index) => ({
    title: toLocalTaskTitle(line, index),
    description: stripSpeaker(line),
    assignee: inferAssigneeName(line),
    priority: inferLocalPriority(line),
    startDate: "",
    deadline: "",
    confidence: 0,
    sourceQuote: line.slice(0, 280),
    reason: language === "Vietnamese" ? "Phat hien giao viec ro rang trong noi dung cuoc hop" : "Detected explicit action wording in the meeting content",
  })), transcript);

  const themes = inferThemes(lines);
  const summary = language === "English"
    ? tasks.length
      ? `The meeting contains ${lines.length} discussion points and ${tasks.length} actionable follow-ups. Review the suggestions before creating official tasks.`
      : noWorkSummary(transcript)
    : themes.length
      ? `Cuoc hop ghi nhan cac chu de chinh: ${themes.join(", ")}. Nhung viec can xu ly tiep theo gom ${tasks.slice(0, 4).map((task) => task.title).join("; ")}.`
      : tasks.length
        ? `Cuoc hop co ${lines.length} y noi dung va ${tasks.length} viec can theo doi. Nen review lai cac task duoc de xuat truoc khi tao cong viec chinh thuc.`
        : noWorkSummary(transcript);

  return {
    transcript,
    summary,
    keyDecisions: decisionLines.map(stripSpeaker),
    actionItems: selected.map(stripSpeaker),
    risks: riskLines.map(stripSpeaker),
    tasks,
  };
}

export function extractExplicitResponsibilityTasks(transcript: string): VoiceAnalysisTask[] {
  const language = detectTranscriptLanguage(transcript);
  const tasks: VoiceAnalysisTask[] = [];
  const assignmentPattern = /(?:^|[\s,;:()-])(?:(em|tôi|toi|mình|minh)\s+|(?:anh|chị|chi|bạn|ban)\s+([\p{L}]+)\s+|([\p{L}]+)\s+)(?:sẽ|se)?\s*(?:là|la|làm|lam|phụ trách|phu trach|đảm nhiệm|dam nhiem)\s+(backend|front[\s-]?end)\b/giu;
  const correctionCuePattern = /(?:à\s+không|a\s+khong|nhưng\s+thôi|nhung\s+thoi|thôi\s+để|thoi\s+de|đổi\s+lại|doi\s+lai)/giu;

  for (const line of transcript.split(/\n+|(?<=[.!?])\s+/).map((value) => value.trim()).filter(Boolean)) {
    for (const match of line.matchAll(assignmentPattern)) {
      const selfReference = Boolean(match[1]);
      const assignee = selfReference ? "SELF" : (match[2] || match[3] || "").trim();
      const role = normalizeText(match[4] || "").replace(/[\s-]+/g, "") === "frontend" ? "frontend" : "backend";
      if (!assignee) continue;
      tasks.push(buildResponsibilityTask(assignee, role, line, language));
    }

    for (const correction of line.matchAll(correctionCuePattern)) {
      const correctionEnd = (correction.index || 0) + correction[0].length;
      const suffix = line.slice(correctionEnd);
      const correctedAssignment = suffix.match(/^\s*[,;:-]?\s*(?:(?:để|de)\s+)?(?:(?:anh|chị|chi|bạn|ban)\s+)?([\p{L}][\p{L}\d_-]*)(?:\s+\(([^)]+)\))?\s+(?:sẽ|se)?\s*(?:là|la|làm|lam|phụ trách|phu trach|đảm nhiệm|dam nhiem)\b/iu);
      if (!correctedAssignment) continue;

      const prefixRoles = [...line.slice(0, correction.index || 0).matchAll(/\b(backend|front[\s-]?end)\b/giu)];
      const suffixRoles = [...suffix.matchAll(/\b(backend|front[\s-]?end)\b/giu)];
      const explicitRole = suffixRoles[0]?.[1];
      const priorRole = prefixRoles.at(-1)?.[1];
      const roleText = explicitRole || priorRole || "";
      if (!roleText) continue;

      const role = normalizeText(roleText).replace(/[\s-]+/g, "") === "frontend" ? "frontend" : "backend";
      const qualifier = correctedAssignment[2]?.trim();
      const assignee = qualifier
        ? `${correctedAssignment[1]} (${qualifier})`
        : correctedAssignment[1] || "";
      if (!assignee) continue;

      for (let index = tasks.length - 1; index >= 0; index -= 1) {
        if (responsibilityKey(tasks[index] || {}).endsWith(`:${role}`)) tasks.splice(index, 1);
      }
      tasks.push(buildResponsibilityTask(assignee, role, line, language, true));
    }
  }

  return filterActionableTaskCandidates(tasks, transcript);
}

function buildResponsibilityTask(
  assignee: string,
  role: "backend" | "frontend",
  sourceQuote: string,
  language: "Vietnamese" | "English" | "Mixed",
  corrected = false,
): VoiceAnalysisTask {
  const useVietnamese = language !== "English";
  return {
    title: useVietnamese ? `Phụ trách ${role}` : `Own ${role} work`,
    description: useVietnamese
      ? `${assignee === "SELF" ? "Người nói" : assignee} được phân công phụ trách ${role}.`
      : `${assignee === "SELF" ? "The speaker" : assignee} is assigned ${role} responsibility.`,
    assignee,
    priority: inferLocalPriority(sourceQuote),
    startDate: "",
    deadline: "",
    confidence: 0,
    sourceQuote: sourceQuote.slice(0, 280),
    reason: useVietnamese
      ? corrected
        ? "Giữ phân công mới nhất sau khi người nói sửa lại"
        : "Phát hiện phân công trách nhiệm rõ ràng trong transcript"
      : corrected
        ? "Kept the latest assignment after an explicit correction"
        : "Detected an explicit responsibility assignment in the transcript",
  };
}

function hasExecutionSignal(transcript: string): boolean {
  return transcript
    .split(/\n+|(?<=[.!?])\s+/)
    .some((line) => !isNoWorkStatement(line) && (hasActionSignal(line) || hasDecisionSignal(line) || hasRiskSignal(line)));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function hasActionSignal(line: string): boolean {
  if (isNoWorkStatement(line)) return false;
  const text = normalizeText(line);
  return /\b(can|phai|deadline|truoc|fix|review|chuan bi|thong bao|check|goi|follow up|demo|cap|set|doi|viet|tao|update|chot|ping|bao|xu ly|lam|gui|phan cong|giao viec|phu trach|dam nhiem|nhan viec|handle|note|ghi chu|tao ticket|jira|docs)\b/.test(text)
    || /(?:^|\s)(?:anh|chi|em|ban|toi|minh|[\p{L}]+)\s+(?:se\s+)?(?:la|lam|phu trach|dam nhiem)\s+(?:backend|front[\s-]?end)\b/u.test(text)
    || /\b(?:ca\s+)?(?:team|nhom)\s+[\p{L}0-9_-]+\s+(?:se\s+)?(?:fix|review|check|handle|lam|viet|tao|update|xu ly|ghi|note)\b/u.test(text)
    || /\bhoi\s+(gia|y kien|vendor|sep|s3|quyen|khach|doi tac)\b/.test(text)
    || /\b(need|needs|must|should|todo|task|prepare|send|create|update|review|finish|call|ask|notify|follow up|fix|demo)\b/.test(text);
}

/** Keeps task cards limited to explicit, evidenced work from the meeting. */
export function filterActionableTaskCandidates<T extends TaskCandidate>(tasks: T[], transcript: string): T[] {
  const seen = new Set<string>();
  const seenResponsibilityRoles = new Set<string>();
  return tasks.filter((task) => {
    if (!isActionableTaskCandidate(task, transcript)) return false;
    const responsibility = responsibilityKey(task);
    if (responsibility) {
      const [assignee, role] = responsibility.split(":");
      if (seen.has(responsibility) || (!assignee && seenResponsibilityRoles.has(role || ""))) return false;
      seen.add(responsibility);
      seenResponsibilityRoles.add(role || "");
      return true;
    }
    const key = normalizeText(task.title || task.description || task.sourceQuote || "").replace(/\b(task|viec|cong viec)\b/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isActionableTaskCandidate(task: TaskCandidate, transcript: string): boolean {
  const evidence = (task.sourceQuote || task.description || task.title || "").trim();
  if (!evidence || !hasTranscriptEvidence(evidence, transcript)) return false;

  const text = normalizeText(evidence);
  if (isNoWorkStatement(evidence) || isStatusUpdate(text)) return false;
  if (/\[(?:cuoi|laughs?|joking)\]/.test(text)) return false;

  const actionPattern = "fix|review|chuan bi|thong bao|check|goi|follow up|demo|cap|set|doi|viet|tao|update|ping|xu ly|lam|gui|nghien cuu|phan quyen|ghi|day|upload|phan cong|giao viec|phu trach|dam nhiem|nhan viec|handle|note|ghi chu|tao ticket";
  const responsibilityAssignment = /(?:^|\s)(?:anh|chi|em|ban|toi|minh|[\p{L}]+)\s+(?:se\s+)?(?:la|lam|phu trach|dam nhiem)\s+(?:backend|front[\s-]?end)\b/u.test(text);
  const teamAssignment = /\b(?:ca\s+)?(?:team|nhom)\s+[\p{L}0-9_-]+\s+(?:se\s+)?(?:fix|review|check|handle|lam|viet|tao|update|xu ly|ghi|note)\b/u.test(text);
  const hasWorkVerb = new RegExp(`\\b(?:${actionPattern})\\b`).test(text) || responsibilityAssignment || teamAssignment;
  if (!hasWorkVerb) return false;

  const assignedAction = new RegExp(`(?:^|[\\s\\]])(?:anh|chi|em|ban)?\\s*[a-z]{2,20}\\s+(?:${actionPattern})\\b`).test(text);
  const taskCue = /\b(hay|nho|giup|nha|truoc|hom nay|tuan|deadline|xong|ping|demo|gui|cap quyen|tao|set|note|ticket|jira|docs)\b/.test(text);
  const questionOnly = /\?|\b(cho .* hoi|co .* khong|hay .* khong|sao anh)\b/.test(text) && !assignedAction && !taskCue;
  if (questionOnly) return false;

  const decisionOnly = /\b(giu|quyet dinh|uu tien|tam dung|de .* sprint sau|tap trung)\b/.test(text) && !assignedAction && !taskCue;
  return !decisionOnly && (assignedAction || taskCue || responsibilityAssignment || teamAssignment);
}

function responsibilityKey(task: TaskCandidate): string {
  const primaryText = normalizeText(`${task.title || ""} ${task.description || ""}`);
  const evidenceText = normalizeText(task.sourceQuote || "");
  const roleText = /\b(?:backend|front[\s-]?end)\b/.test(primaryText) ? primaryText : evidenceText;
  const role = /\bbackend\b/.test(roleText)
    ? "backend"
    : /\bfront[\s-]?end\b/.test(roleText)
      ? "frontend"
      : "";
  if (!role) return "";
  const normalizedAssignee = normalizeText(task.assignee || "")
    .replace(/\b(anh|chi|ban)\b/g, "")
    .replace(/\s+/g, "")
    .trim();
  const assignee = /^(self|speaker|toi|minh|em)$/.test(normalizedAssignee) ? "self" : normalizedAssignee;
  return `${assignee}:${role}`;
}

function hasTranscriptEvidence(evidence: string, transcript: string): boolean {
  const normalizedEvidence = normalizeText(evidence);
  const normalizedTranscript = normalizeText(transcript);
  if (!normalizedEvidence || !normalizedTranscript) return false;
  if (normalizedTranscript.includes(normalizedEvidence)) return true;

  const ignored = new Set(["anh", "chi", "em", "ban", "minh", "voi", "cho", "cua", "the", "nay", "mot", "cac", "phan"]);
  const terms = [...new Set(normalizedEvidence.split(/[^a-z0-9]+/).filter((term) => term.length >= 2 && !ignored.has(term)))];
  if (terms.length < 2) return false;
  const matches = terms.filter((term) => normalizedTranscript.includes(term)).length;
  const minimum = terms.length <= 3 ? 2 : Math.max(3, Math.ceil(terms.length / 2));
  return matches >= minimum;
}

function isStatusUpdate(text: string): boolean {
  return /\b(da xong|gan xong|dang lam|van lam|da lam|da xu ly)\b/.test(text);
}

function hasDecisionSignal(line: string): boolean {
  if (isNoWorkStatement(line)) return false;
  const text = normalizeText(line);
  return /\b(chot|quyet dinh|giu|tam dung|doi het|uu tien|de sprint sau|tap trung)\b/.test(text)
    || /\b(decided|keep|pause|prioritize|defer|focus)\b/.test(text);
}

function hasRiskSignal(line: string): boolean {
  if (isNoWorkStatement(line)) return false;
  const text = normalizeText(line);
  return /\b(rui ro|tre|phan nan|het|cat|cao|anh huong|loi|bug|token|credit|chay|bao tri|tang)\b/.test(text)
    || /\b(risk|late|delay|complain|blocked|bug|issue|quota|credit|maintenance|increase)\b/.test(text);
}

function isNoWorkStatement(line: string): boolean {
  const text = normalizeText(line);
  return /\b(khong co|khong thay|khong phat sinh|chua co)\b.*\b(cong viec|nhiem vu|task|action item|viec can lam|quyet dinh|deadline|ke hoach|rui ro)\b/.test(text)
    || /\b(no|not any|none|without)\b.*\b(task|action item|work item|decision|deadline|risk|assignment)\b/.test(text);
}

function inferThemes(lines: string[]): string[] {
  const joined = normalizeText(lines.join(" "));
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

function toLocalTaskTitle(line: string, index: number): string {
  const text = stripSpeaker(line)
    .replace(/^(ok|vang|da|u|uh|a)\b[:,\s-]*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return (text || `Task ${index + 1}`).slice(0, 120);
}

function stripSpeaker(line: string): string {
  return line.replace(/^\[[^\]]+\]\s*/, "").replace(/^[A-Za-zÀ-ỹ ]+:\s*/, "").trim();
}

function inferAssigneeName(line: string): string {
  const speaker = line.match(/^\[([^\]]+)\]/)?.[1]?.trim();
  const selfAssignment = line.match(/\b(em|tôi|toi|mình|minh)\s+(?:sẽ|se)?\s*(?:là|la|làm|lam|phụ trách|phu trach|đảm nhiệm|dam nhiem)\s+(?:backend|front[\s-]?end)\b/iu);
  if (selfAssignment) return "SELF";
  const roleAssignment = line.match(/\b(?:anh|chị|chi|bạn|ban)\s+([\p{L}]+)\s+(?:sẽ|se)?\s*(?:là|la|làm|lam|phụ trách|phu trach|đảm nhiệm|dam nhiem)\s+(?:backend|front[\s-]?end)\b/iu)?.[1];
  const direct = line.match(/\b(?:anh|chi|chị|em|ban|bạn)?\s*([A-ZÀ-Ỹ][\p{L}]{1,20})\s+(?:fix|review|chuan|chuẩn|cap|cấp|set|doi|đổi|viet|viết|nghien|nghiên|lam|làm|bao|báo|hoi|hỏi|goi|gọi|ping|gui|gửi)/u)?.[1];
  return roleAssignment || direct || speaker || "";
}

function inferLocalPriority(line: string): "LOW" | "MEDIUM" | "HIGH" {
  const text = normalizeText(line);
  if (/\b(vip|phan nan|tre|loi|bug|token|credit|chay|deadline|truoc thu|cao|high|het|bao tri|urgent|critical|blocked|asap)\b/.test(text)) {
    return "HIGH";
  }
  if (/\b(de sprint sau|sau|optional|later)\b/.test(text)) return "LOW";
  return "MEDIUM";
}

function normalizeAiPriority(value: string): "LOW" | "MEDIUM" | "HIGH" {
  const priority = String(value || "").toUpperCase();
  if (priority === "HIGH" || priority === "URGENT") return "HIGH";
  if (priority === "LOW") return "LOW";
  return "MEDIUM";
}

export function calculateTaskConfidence(
  task: Pick<VoiceAnalysisTask, "title" | "description" | "assignee" | "startDate" | "deadline" | "sourceQuote">,
  transcript: string,
): number {
  const evidence = (task.sourceQuote || task.description || task.title || "").trim();
  if (!evidence || !isActionableTaskCandidate(task, transcript)) return 0;

  const text = normalizeText(evidence);
  let score = hasExactTranscriptEvidence(evidence, transcript) ? 0.6 : 0.48;
  if (task.assignee.trim() || hasExplicitAssignee(text)) score += 0.14;
  if (task.deadline.trim() || hasRelativeDeadlineEvidence(evidence)) score += 0.12;
  if (task.startDate.trim() || hasStartDateEvidence(evidence)) score += 0.05;
  if (hasDirectRequestCue(text)) score += 0.06;
  if (/\b(neu co thoi gian|neu ranh|khi nao ranh|if time permits|if possible)\b/.test(text)) {
    score = Math.min(score, 0.55);
  }
  if (/\[(?:unclear|khong ro)\]|\b(?:nghe khong ro|stt co the sai|khong chac ten|khong chac so)\b/.test(text)) {
    score = Math.min(score, 0.55);
  }
  return Math.round(Math.min(score, 0.97) * 100) / 100;
}

function hasExactTranscriptEvidence(evidence: string, transcript: string): boolean {
  const normalizedEvidence = normalizeText(evidence);
  return Boolean(normalizedEvidence) && normalizeText(transcript).includes(normalizedEvidence);
}

function hasExplicitAssignee(text: string): boolean {
  return /(?:^|[\s\]])(?:anh|chi|em|ban)?\s*[a-z]{2,20}\s+(?:fix|review|chuan bi|check|goi|demo|cap|set|doi|viet|tao|update|ping|xu ly|lam|gui|nghien cuu)\b/.test(text);
}

function hasDirectRequestCue(text: string): boolean {
  return /\b(hay|nho|giup|please|need to|needs to|must|should|will)\b/.test(text);
}

function hasStartDateEvidence(text: string): boolean {
  const normalized = normalizeText(text);
  return /\b(bat dau|tu ngay|ke tu|starting|start on|begin on)\b/.test(normalized);
}

export function normalizeStartDate(value: string, source: string, transcript: string, referenceDate?: string): string {
  const startDate = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !parseIsoDate(startDate)) return "";

  const evidence = `${source}\n${transcript}`;
  if (!hasStartDateEvidence(evidence)) return "";
  if (hasAbsoluteDeadlineEvidence(evidence)) return startDate;

  const reference = parseIsoDate(referenceDate || "");
  if (!reference) return "";
  const generated = parseIsoDate(startDate);
  if (!generated) return "";
  const diffDays = Math.round((generated.getTime() - reference.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 45 ? startDate : "";
}

function normalizeDeadline(value: string, source: string, transcript: string, _referenceDate?: string): string {
  const evidence = `${source}\n${transcript}`;
  const deadline = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return "";

  const generated = parseIsoDate(deadline);
  if (!generated) return "";

  if (hasAbsoluteDeadlineEvidence(evidence)) return isFutureOrToday(deadline) ? deadline : "";
  return "";
}

function isFutureOrToday(value: string): boolean {
  const date = parseIsoDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}

function resolveReferenceDate(transcript: string, fallback?: string): string | undefined {
  const explicit = extractExplicitReferenceDate(transcript);
  if (explicit) return explicit;
  const iso = fallback?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return iso && parseIsoDate(iso) ? iso : undefined;
}

function extractExplicitReferenceDate(text: string): string | undefined {
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (numeric) return toIsoDate(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));

  const vietnamese = normalizeText(text).match(/\bngay\s+(\d{1,2})\s+thang\s+(\d{1,2})\s+nam\s+(\d{4})\b/);
  if (vietnamese) return toIsoDate(Number(vietnamese[1]), Number(vietnamese[2]), Number(vietnamese[3]));

  return undefined;
}

function hasAbsoluteDeadlineEvidence(text: string): boolean {
  const normalized = normalizeText(text);
  return /\b\d{4}-\d{2}-\d{2}\b/.test(text)
    || /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/.test(text)
    || /\bngay\s+\d{1,2}\s+thang\s+\d{1,2}(?:\s+nam\s+\d{4})?\b/.test(normalized);
}

function hasRelativeDeadlineEvidence(text: string): boolean {
  const normalized = normalizeText(text);
  return /\b(deadline|han chot|truoc|xong truoc|hom nay|ngay mai|tuan nay|tuan sau|thu hai|thu ba|thu tu|thu nam|thu sau|thu bay|chu nhat|cuoi tuan|next week|this week|today|tomorrow|by friday|before friday)\b/.test(normalized);
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(day: number, month: number, year: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
}

function audioPrompt(referenceDate?: string): string {
  return `${executionPromptHeader(referenceDate)}

Listen to the whole audio carefully before producing JSON. Transcribe the spoken language faithfully, preserve names and technical terms, then produce the execution analysis in that same language.`;
  return `Bạn là trợ lý phân tích cuộc họp. Hãy nghe file audio và thực hiện:

1. Transcribe toàn bộ nội dung bằng tiếng Việt (giữ nguyên speaker nếu phân biệt được)
2. Tóm tắt ngắn gọn nội dung
3. Các quyết định quan trọng
4. Các việc cần làm (tasks) — mỗi task có title, description, assignee (nếu có tên người được giao), priority (HIGH/MEDIUM/LOW), deadline (nếu có)
5. Các rủi ro cần theo dõi

CHỈ trả về JSON:
{
  "transcript": "full transcript",
  "summary": "tóm tắt",
  "keyDecisions": ["quyết định"],
  "actionItems": ["việc cần làm"],
  "tasks": [
    {"title": "tên công việc", "description": "mô tả", "assignee": "người được giao", "priority": "HIGH|MEDIUM|LOW", "deadline": "YYYY-MM-DD"}
  ],
  "risks": ["rủi ro"]
}`;
}

function transcriptionPrompt(): string {
  return [
    "You are a precise multilingual meeting transcription engine.",
    "Listen to the entire audio before responding. Return a faithful, complete transcription only.",
    "Keep the language actually spoken. Do not translate Vietnamese to English or English to Vietnamese.",
    "Preserve Vietnamese diacritics, names, numbers, and technical terms such as AI, backend, frontend, Cognito, LiveKit, DynamoDB, S3, WebSocket, and VNPay.",
    "Use sentence context to distinguish common Vietnamese work phrases such as 'thử tính năng AI', 'phân công công việc', 'phụ trách backend', and 'phụ trách frontend'; do not swap their word order or omit a coordinated assignment.",
    "When several people or responsibilities are mentioned in one sentence, transcribe every clause completely and preserve each person's name.",
    "Use speaker labels only when the speaker is clear. Do not summarize, omit sentences, or invent words; write [unclear] for unintelligible speech.",
    "Return valid JSON only: {\"transcript\": \"full verbatim transcript in the spoken language\"}",
  ].join("\n");
}

function textPrompt(transcriptText: string, referenceDate?: string): string {
  return `${executionPromptHeader(referenceDate, transcriptText)}

Transcript:
${transcriptText}`;
  return `Bạn là trợ lý phân tích cuộc họp chuyên nghiệp. Nhiệm vụ của bạn là phân tích nội dung cuộc họp và trích xuất thông tin có thể hành động.

Yêu cầu đầu ra JSON:
{
  "transcript": "toàn bộ nội dung",
  "summary": "tóm tắt ngắn gọn nội dung cuộc họp bằng tiếng Việt",
  "keyDecisions": ["quyết định 1", "quyết định 2"],
  "actionItems": ["việc cần làm 1", "việc cần làm 2"],
  "tasks": [
    {
      "title": "tên công việc cụ thể",
      "description": "mô tả chi tiết công việc",
      "assignee": "tên người được giao (nếu có, trích từ nội dung)",
      "priority": "HIGH|MEDIUM|LOW",
      "deadline": "hạn chót nếu có (YYYY-MM-DD)"
    }
  ],
  "risks": ["rủi ro / vấn đề cần theo dõi"]
}

HƯỚNG DẪN QUAN TRỌNG:
- Phân tích KỸ nội dung để tìm ra người được giao việc (assignee)
- Nếu có tên người kèm công việc (vd: "Anh Minh báo...", "chị Lan nói...", "An nói...", "Lực giao..."), hãy trích xuất làm assignee
- Tóm tắt bằng tiếng Việt, ngắn gọn nhưng đủ ý chính
- Mỗi task cần có title rõ ràng, description chi tiết
- Chỉ lấy thông tin được đề cập trong transcript
- Nếu không có assignee hoặc deadline thì để chuỗi rỗng

Transcript:
${transcriptText}`;
}

export function decodeTranscriptBuffer(buffer: Uint8Array): string {
  const candidates = [
    decodeWithEncoding(buffer, "utf-8"),
    decodeWithEncoding(buffer, "windows-1258"),
    decodeWithEncoding(buffer, "windows-1252"),
  ].filter((value): value is string => value !== null);
  const best = candidates.reduce((current, candidate) => (
    textQuality(candidate) > textQuality(current) ? candidate : current
  ), candidates[0] || "");
  return normalizeTranscriptText(best);
}

export function normalizeTranscriptText(value: string): string {
  return repairCommonMojibake(String(value || ""))
    .normalize("NFC")
    .replace(/\r\n?/g, "\n");
}

export function detectTranscriptLanguage(value: string): "Vietnamese" | "English" {
  const original = String(value || "");
  if (/[ăâđêôơưà-ỹ]/i.test(original)) return "Vietnamese";

  const text = normalizeText(original);
  const vietnameseWords = text.match(/\b(va|la|cho|khong|duoc|trong|voi|can|phai|nhung|mot|nguoi|ngay|tuan|thang|hop|viec|giao|lam|gui)\b/g)?.length || 0;
  const englishWords = text.match(/\b(the|and|for|with|this|that|need|will|should|task|meeting|review|please|before|next|week)\b/g)?.length || 0;
  return vietnameseWords > englishWords ? "Vietnamese" : "English";
}

function decodeWithEncoding(buffer: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(buffer);
  } catch {
    return null;
  }
}

function textQuality(value: string): number {
  const invalid = (value.match(/[\uFFFD]/g) || []).length;
  const mojibake = (value.match(/(?:Ã.|Â.|â.|Ä.|á»)/g) || []).length;
  const vietnamese = (value.match(/[ăâđêôơưà-ỹ]/gi) || []).length;
  return value.length + vietnamese * 4 - invalid * 80 - mojibake * 12;
}

function repairCommonMojibake(value: string): string {
  if (!/(?:Ã.|Â.|â.|Ä.|á»)/.test(value)) return value;
  const windows1252 = new Map<number, number>([[0x20AC, 0x80], [0x201A, 0x82], [0x201E, 0x84], [0x2026, 0x85], [0x2013, 0x96], [0x2014, 0x97], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2122, 0x99]]);
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) || 0;
    const byte = code <= 0xFF ? code : windows1252.get(code);
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  const candidate = Buffer.from(bytes).toString("utf8");
  return textQuality(candidate) > textQuality(value) ? candidate : value;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "webm";
}

function toGeminiMimeType(mimeType: string, storageKey: string): string {
  const lowerType = mimeType.toLowerCase();
  const lowerKey = storageKey.toLowerCase();
  if (lowerType.includes("mpeg") || lowerType.includes("mp3") || lowerKey.endsWith(".mp3")) return "audio/mp3";
  if (lowerType.includes("wav") || lowerKey.endsWith(".wav")) return "audio/wav";
  if (lowerType.includes("m4a") || lowerKey.endsWith(".m4a")) return "audio/mp4";
  if (lowerType.includes("webm") || lowerKey.endsWith(".webm")) return "audio/webm";
  if (lowerType.includes("ogg") || lowerKey.endsWith(".ogg")) return "audio/ogg";
  return mimeType || "application/octet-stream";
}

function isTextInput(mimeType: string, storageKey: string): boolean {
  const lowerType = mimeType.toLowerCase();
  const lowerKey = storageKey.toLowerCase();
  return lowerType.startsWith("text/") ||
    lowerKey.endsWith(".txt") ||
    lowerKey.endsWith(".vtt") ||
    lowerKey.endsWith(".srt");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
