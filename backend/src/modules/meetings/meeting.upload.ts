import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";

const s3 = new S3Client({ region: env.AWS_REGION });

export interface MeetingUploadInput {
  workspaceId: string;
  meetingId: string;
  fileName: string;
  contentType: string;
}

export async function createMeetingUploadUrl(input: MeetingUploadInput): Promise<{
  uploadUrl: string;
  storageKey: string;
  bucket: string;
}> {
  const bucket = env.VOICE_RECORDINGS_BUCKET || env.AUDIO_BUCKET;
  if (!bucket) throw new Error("VOICE_RECORDINGS_BUCKET or AUDIO_BUCKET is required");

  const storageKey = [
    "meetings",
    sanitizePathSegment(input.workspaceId),
    sanitizePathSegment(input.meetingId),
    `${randomUUID()}-${sanitizeFileName(input.fileName)}`,
  ].join("/");

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: input.contentType || "application/octet-stream",
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
  return { uploadUrl, storageKey, bucket };
}

export function mimeTypeForStorageKey(storageKey: string): string {
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".vtt")) return "text/vtt";
  if (lower.endsWith(".srt")) return "text/plain";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function sanitizeFileName(name = "meeting-file"): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe || "meeting-file";
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
