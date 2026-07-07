import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";

const s3 = new S3Client({ region: env.AWS_REGION });

export interface WorkspaceAttachmentUploadInput {
  workspaceId: string;
  userId: string;
  fileName: string;
  contentType: string;
}

export async function createWorkspaceAttachmentUploadUrl(input: WorkspaceAttachmentUploadInput): Promise<{
  id: string;
  uploadUrl: string;
  downloadUrl: string;
  storageKey: string;
  bucket: string;
  expiresAt: string;
}> {
  const bucket = env.VOICE_RECORDINGS_BUCKET || env.AUDIO_BUCKET;
  if (!bucket) throw new Error("VOICE_RECORDINGS_BUCKET or AUDIO_BUCKET is required");

  const id = randomUUID();
  const storageKey = [
    "workspace-attachments",
    sanitizePathSegment(input.workspaceId),
    sanitizePathSegment(input.userId),
    `${id}-${sanitizeFileName(input.fileName)}`,
  ].join("/");

  const contentType = input.contentType || "application/octet-stream";
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
    }),
    { expiresIn: 900 },
  );
  const downloadUrlTtlSeconds = 60 * 60 * 24 * 7;
  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    { expiresIn: downloadUrlTtlSeconds },
  );

  return {
    id,
    uploadUrl,
    downloadUrl,
    storageKey,
    bucket,
    expiresAt: new Date(Date.now() + downloadUrlTtlSeconds * 1000).toISOString(),
  };
}

function sanitizeFileName(name = "attachment"): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe || "attachment";
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
