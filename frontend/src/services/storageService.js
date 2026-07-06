import { runtimeConfig } from '@/config/runtimeConfig';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_AUDIO_EXTENSIONS,
  MAX_AI_AUDIO_SIZE_BYTES,
} from '@/domain/constants/costConstants';

export async function requestPresignedUploadUrl(metadata) {
  const fileName = sanitizeFileName(metadata?.fileName || 'meeting-file');
  const fileType = metadata?.fileType || 'application/octet-stream';
  const fileSize = metadata?.fileSize || 0;

  const response = await fetch(`${runtimeConfig.apiBaseUrl}/storage/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileType, fileSize }),
  });
  if (!response.ok) throw new Error('Unable to request upload URL');
  return response.json();
}

export async function uploadFileToStorage(file, uploadUrl) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: file?.type ? { 'Content-Type': file.type } : undefined,
  });
  if (!response.ok) throw new Error('Storage upload failed');
  return { ok: true };
}

export async function requestSignedDownloadUrl(storageKey) {
  if (!storageKey) return null;
  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/presign-download?key=${encodeURIComponent(storageKey)}`
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.downloadUrl || null;
}

export async function deleteStoredFile(storageKey) {
  if (!storageKey) return { ok: false };
  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/file?key=${encodeURIComponent(storageKey)}`,
    { method: 'DELETE' }
  );
  return { ok: response.ok };
}

export async function getFileMetadata(storageKey) {
  if (!storageKey) return null;
  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/file?key=${encodeURIComponent(storageKey)}`
  );
  if (!response.ok) return null;
  return response.json();
}

export function validateFileBeforeUpload(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const typeAllowed =
    !file.type || ALLOWED_AUDIO_MIME_TYPES.includes(file.type);
  const extAllowed = ALLOWED_AUDIO_EXTENSIONS.test(file.name || '');

  if (!typeAllowed || !extAllowed) {
    return {
      valid: false,
      error: 'Only MP3, WAV, M4A, OGG, WebM audio files or TXT transcripts are allowed.',
    };
  }

  if (file.size > MAX_AI_AUDIO_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${Math.round(MAX_AI_AUDIO_SIZE_BYTES / (1024 * 1024))} MB.`,
      size: file.size,
    };
  }

  return { valid: true, type: file.type, size: file.size };
}

export async function checkFileExists(fileHash) {
  if (!fileHash) return { exists: false };
  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/check?hash=${encodeURIComponent(fileHash)}`
  );
  if (!response.ok) return { exists: false };
  return response.json();
}

export function registerFileHash(fileHash, storageKey) {
  return Boolean(fileHash && storageKey);
}

export async function computeFileHash(file) {
  if (!file) return '';

  const raw = `${file.name}|${file.size}|${file.lastModified || 0}`;

  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(raw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch {
      // Fall through to a deterministic lightweight hash.
    }
  }

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function sanitizeFileName(name = 'meeting-file') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export const requestUploadUrl = requestPresignedUploadUrl;

export function getFileUrl(fileKey) {
  if (!fileKey) return null;
  return `${runtimeConfig.apiBaseUrl}/storage/file?key=${encodeURIComponent(fileKey)}`;
}
