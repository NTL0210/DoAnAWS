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
  }>;
}> {
  if (!input.storageKey) throw new Error("Audio storageKey is missing");
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");

  const bucket = getVoiceRecordingBucket();
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: input.storageKey }));
  const body = response.Body;
  if (!body) throw new Error("Audio file is empty");
  const buffer = Buffer.from(await body.transformToByteArray());
  if (buffer.length === 0) throw new Error("Audio file is empty");

  const fileUri = await uploadToGemini(buffer, input.mimeType);
  const raw = await callGeminiWithFile(fileUri, input.mimeType, audioPrompt());
  return normalizeGeminiJson(raw);
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
      generationConfig: { temperature: 0.25, maxOutputTokens: 8192 },
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
        }))
      : [],
  };
}

function emptyAnalysis(): VoiceAnalysisResult {
  return { transcript: "", summary: "", keyDecisions: [], actionItems: [], risks: [], tasks: [] };
}

function audioPrompt(): string {
  return `Transcribe this voice meeting audio and analyze it for execution.
Return only JSON with this shape:
{
  "transcript": "full transcript",
  "summary": "short meeting summary",
  "keyDecisions": ["decision"],
  "actionItems": ["action item"],
  "tasks": [
    {"title": "task title", "description": "details", "assignee": "", "priority": "HIGH|MEDIUM|LOW", "deadline": ""}
  ],
  "risks": ["risk"]
}
Use Vietnamese when the conversation is Vietnamese. Only include work that is clearly supported by the audio.`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "webm";
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
