import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import type { VoiceRecording } from "./voice-recording.types.js";

const s3 = new S3Client({ region: env.AWS_REGION });
const geminiBase = "https://generativelanguage.googleapis.com/v1beta/models";

interface VoiceAnalysisResult {
  transcript: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: string[];
  tasks: Array<{
    title: string;
    description: string;
    assignee: string;
    priority: string;
    deadline: string;
    sourceQuote?: string;
    reason?: string;
  }>;
}

export function getVoiceRecordingBucket(): string {
  const bucket = env.VOICE_RECORDINGS_BUCKET || env.AUDIO_BUCKET;
  if (!bucket) throw new Error("VOICE_RECORDINGS_BUCKET or AUDIO_BUCKET is required");
  return bucket;
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

export async function createVoiceDownloadUrl(recording: VoiceRecording): Promise<string | null> {
  if (!recording.storageKey) return null;
  const command = new GetObjectCommand({
    Bucket: getVoiceRecordingBucket(),
    Key: recording.storageKey,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function analyzeVoiceRecording(recording: VoiceRecording): Promise<{
  transcript: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: string[];
  tasks: Array<{
    title?: string;
    description?: string;
    assignee?: string;
    priority?: string;
    deadline?: string;
    sourceQuote?: string;
    reason?: string;
  }>;
}> {
  if (!recording.storageKey) throw new Error("Voice recording storageKey is missing");
  return analyzeStoredAudio({ storageKey: recording.storageKey, mimeType: recording.mimeType });
}

export async function analyzeStoredAudio(input: { storageKey: string; mimeType: string }): Promise<{
  transcript: string;
  summary: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: string[];
  tasks: Array<{
    title?: string;
    description?: string;
    assignee?: string;
    priority?: string;
    deadline?: string;
    sourceQuote?: string;
    reason?: string;
  }>;
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
    return analyzeTranscriptText(buffer.toString("utf8"));
  }

  const fileUri = await uploadToGemini(buffer, input.mimeType);
  const raw = await callGeminiWithFile(fileUri, input.mimeType, audioPrompt());
  return ensureActionableAnalysis(normalizeGeminiJson(raw), "");
}

export async function analyzeTranscriptText(transcriptText: string): Promise<VoiceAnalysisResult> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
  const trimmed = transcriptText.trim();
  if (!trimmed) return emptyAnalysis();
  const raw = await callGeminiWithText(textPrompt(trimmed));
  return ensureActionableAnalysis(normalizeGeminiJson(raw), trimmed);
}

async function uploadToGemini(fileBuffer: Buffer, mimeType: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start, upload, finalize",
      "X-Goog-Upload-Header-Content-Length": String(fileBuffer.length),
      "Content-Type": mimeType,
    },
    body: fileBuffer as unknown as BodyInit,
  });
  if (!response.ok) {
    throw new Error(`Gemini upload failed: HTTP ${response.status}`);
  }
  const data = await response.json() as { file?: { uri?: string } };
  if (!data.file?.uri) throw new Error("Gemini upload response missing file uri");
  return data.file.uri;
}

async function callGeminiWithFile(fileUri: string, mimeType: string, prompt: string): Promise<string> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`${geminiBase}/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { fileData: { mimeType, fileUri } },
          { text: prompt },
        ],
      }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 8192, responseMimeType: "application/json" },
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

async function callGeminiWithText(prompt: string): Promise<string> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`${geminiBase}/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 8192, responseMimeType: "application/json" },
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
    transcript: stringValue(parsed.transcript),
    summary: stringValue(parsed.summary),
    keyDecisions: stringArray(parsed.keyDecisions),
    actionItems: stringArray(parsed.actionItems),
    risks: stringArray(parsed.risks),
    tasks: Array.isArray(parsed.tasks)
      ? parsed.tasks.filter(isRecord).map((task) => ({
          title: stringValue(task.title),
          description: stringValue(task.description),
          assignee: stringValue(task.assignee),
          priority: stringValue(task.priority),
          deadline: stringValue(task.deadline),
          sourceQuote: stringValue(task.sourceQuote),
          reason: stringValue(task.reason),
        }))
      : [],
  };
}

function emptyAnalysis(): VoiceAnalysisResult {
  return { transcript: "", summary: "", keyDecisions: [], actionItems: [], risks: [], tasks: [] };
}

function executionPromptHeader(): string {
  return [
    "You are the execution analyst for AI Meeting Workforce Platform.",
    "The user provides only meeting notes, work notes, transcript text, or audio. Do not ask follow-up questions.",
    "Transform the content into execution: synthesized summary, decisions, risks, action items, and task suggestions.",
    "Output language: Vietnamese. Keep person names exactly as spoken/written.",
    "Do not copy the transcript as the summary. The summary must be 3-6 synthesized sentences.",
    "Extract concrete work only. Ignore small talk unless it creates a risk or task.",
    "For each task, infer assignee from explicit assignment, speaker context, or responsibility phrase. Leave empty only if unclear.",
    "Use priority HIGH for blockers, customer escalations, login/auth failures, budget/credit risk, deadlines, production issues, or VIP customers.",
    "Use deadline as YYYY-MM-DD only when the date can be inferred reliably from the content; otherwise use an empty string.",
    "Return valid JSON only. No Markdown, no commentary.",
    "",
    "JSON schema:",
    "{",
    '  "transcript": "full transcript or original text",',
    '  "summary": "synthesized Vietnamese summary",',
    '  "keyDecisions": ["decision"],',
    '  "actionItems": ["action item"],',
    '  "tasks": [',
    "    {",
    '      "title": "specific task title",',
    '      "description": "clear task description",',
    '      "assignee": "person name if known",',
    '      "priority": "HIGH|MEDIUM|LOW",',
    '      "deadline": "YYYY-MM-DD or empty string",',
    '      "sourceQuote": "short evidence from transcript",',
    '      "reason": "why this is a task"',
    "    }",
    "  ],",
    '  "risks": ["risk"]',
    "}",
  ].join("\n");
}

function ensureActionableAnalysis(analysis: VoiceAnalysisResult, fallbackTranscript: string): VoiceAnalysisResult {
  const transcript = (analysis.transcript || fallbackTranscript).trim();
  const local = buildLocalActionableAnalysis(transcript);
  const summary = isUsefulSummary(analysis.summary, transcript) ? analysis.summary.trim() : local.summary;
  const tasks = analysis.tasks
    .filter((task) => (task.title || task.description || "").trim())
    .map((task, index) => ({
      title: task.title || local.tasks[index]?.title || `Task ${index + 1}`,
      description: task.description || task.title || local.tasks[index]?.description || "",
      assignee: task.assignee || local.tasks[index]?.assignee || "",
      priority: normalizeAiPriority(task.priority || local.tasks[index]?.priority || "MEDIUM"),
      deadline: task.deadline || local.tasks[index]?.deadline || "",
      sourceQuote: task.sourceQuote || local.tasks[index]?.sourceQuote || task.description || task.title || "",
      reason: task.reason || local.tasks[index]?.reason || "Extracted from meeting content",
    }));

  return {
    transcript,
    summary,
    keyDecisions: analysis.keyDecisions.length ? analysis.keyDecisions : local.keyDecisions,
    actionItems: analysis.actionItems.length ? analysis.actionItems : local.actionItems,
    risks: analysis.risks.length ? analysis.risks : local.risks,
    tasks: tasks.length ? tasks : local.tasks,
  };
}

function isUsefulSummary(summary: string, transcript: string): boolean {
  const cleanSummary = summary.trim();
  if (cleanSummary.length < 40) return false;
  if (!transcript.trim()) return true;
  const normalizedSummary = normalizeText(cleanSummary);
  const normalizedTranscript = normalizeText(transcript);
  if (normalizedTranscript.startsWith(normalizedSummary.slice(0, 160))) return false;
  return cleanSummary.length < transcript.length * 0.55;
}

function buildLocalActionableAnalysis(transcript: string): VoiceAnalysisResult {
  if (!transcript.trim()) return emptyAnalysis();
  const lines = transcript
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const actionLines = lines.filter((line) => hasActionSignal(line));
  const decisionLines = lines.filter((line) => hasDecisionSignal(line)).slice(0, 6);
  const riskLines = lines.filter((line) => hasRiskSignal(line)).slice(0, 6);
  const selected = (actionLines.length ? actionLines : lines).slice(0, 12);
  const tasks = selected.map((line, index) => ({
    title: toLocalTaskTitle(line, index),
    description: stripSpeaker(line),
    assignee: inferAssigneeName(line),
    priority: inferLocalPriority(line),
    deadline: "",
    sourceQuote: line.slice(0, 280),
    reason: "Detected action wording in the meeting content",
  }));

  const themes = inferThemes(lines);
  const summary = themes.length
    ? `Cuoc hop ghi nhan cac chu de chinh: ${themes.join(", ")}. Nhung viec can xu ly tiep theo gom ${tasks.slice(0, 4).map((task) => task.title).join("; ")}.`
    : `Cuoc hop co ${lines.length} y noi dung va ${tasks.length} viec can theo doi. Nen review lai cac task duoc de xuat truoc khi tao cong viec chinh thuc.`;

  return {
    transcript,
    summary,
    keyDecisions: decisionLines.map(stripSpeaker),
    actionItems: selected.map(stripSpeaker),
    risks: riskLines.map(stripSpeaker),
    tasks,
  };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasActionSignal(line: string): boolean {
  const text = normalizeText(line);
  return /\b(can|phai|deadline|truoc|fix|review|chuan bi|thong bao|check|hoi|goi|follow up|demo|cap|set|doi|viet|tao|update|chot|ping|bao|xu ly|lam|gui)\b/.test(text)
    || /\b(need|needs|must|should|todo|task|prepare|send|create|update|review|finish|call|ask|notify|follow up|fix|demo)\b/.test(text);
}

function hasDecisionSignal(line: string): boolean {
  const text = normalizeText(line);
  return /\b(chot|quyet dinh|giu|tam dung|doi het|uu tien|de sprint sau|tap trung)\b/.test(text)
    || /\b(decided|keep|pause|prioritize|defer|focus)\b/.test(text);
}

function hasRiskSignal(line: string): boolean {
  const text = normalizeText(line);
  return /\b(rui ro|tre|phan nan|het|cat|cao|anh huong|loi|bug|token|credit|chay|bao tri|tang)\b/.test(text)
    || /\b(risk|late|delay|complain|blocked|bug|issue|quota|credit|maintenance|increase)\b/.test(text);
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
  const direct = line.match(/\b(?:anh|chi|chị|em|ban|bạn)?\s*([A-ZÀ-Ỹ][\p{L}]{1,20})\s+(?:fix|review|chuan|chuẩn|cap|cấp|set|doi|đổi|viet|viết|nghien|nghiên|lam|làm|bao|báo|hoi|hỏi|goi|gọi|ping|gui|gửi)/u)?.[1];
  return direct || speaker || "";
}

function inferLocalPriority(line: string): "LOW" | "MEDIUM" | "HIGH" {
  const text = normalizeText(line);
  if (/\b(vip|phan nan|tre|loi|bug|token|credit|chay|deadline|truoc thu|cao|het|bao tri|urgent|critical|blocked|asap)\b/.test(text)) {
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

function audioPrompt(): string {
  return executionPromptHeader();
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

function textPrompt(transcriptText: string): string {
  return `${executionPromptHeader()}

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

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "webm";
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
