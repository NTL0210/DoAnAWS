/**
 * StorageService — abstraction for file storage (mock / S3 presigned URL)
 *
 * Mock mode stores files in an in-memory Map and returns mock URLs.
 * API mode will request presigned URLs from the backend and use S3.
 *
 * All functions are async to mirror real network calls.
 */

import { isApiMode, runtimeConfig } from '@/config/runtimeConfig';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_AUDIO_EXTENSIONS,
  MAX_AI_AUDIO_SIZE_BYTES,
} from '@/domain/constants/costConstants';

// ─── In-memory mock store ───────────────────────────────────────────
/** @type {Map<string, { storageKey: string, fileName: string, fileSize: number, mimeType: string, uploadedAt: string, blob: Blob|null }>} */
const _mockStore = new Map();
const _hashRegistry = new Map(); // fileHash → storageKey

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Request a presigned upload URL (or mock equivalent)
 *
 * @param {Object} metadata
 * @param {string} metadata.fileName
 * @param {string} [metadata.fileType]
 * @param {number} [metadata.fileSize]
 * @returns {Promise<{ uploadUrl: string, storageKey: string, downloadUrl: string|null }>}
 */
export async function requestPresignedUploadUrl(metadata) {
  const fileName = sanitizeFileName(metadata?.fileName || 'meeting-file');
  const fileType = metadata?.fileType || 'application/octet-stream';
  const fileSize = metadata?.fileSize || 0;

  if (!isApiMode()) {
    const storageKey = `mock/meetings/${Date.now()}-${fileName}`;
    const downloadUrl = null; // mock: no download until explicitly requested

    _mockStore.set(storageKey, {
      storageKey,
      fileName,
      fileSize,
      mimeType: fileType,
      uploadedAt: new Date().toISOString(),
      blob: null,
    });

    return {
      uploadUrl: `mock-upload://${storageKey}`,
      storageKey,
      downloadUrl,
    };
  }

  const response = await fetch(`${runtimeConfig.apiBaseUrl}/storage/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileType, fileSize }),
  });
  if (!response.ok) throw new Error('Unable to request upload URL');
  return response.json();
}

/**
 * Upload a file to storage using the presigned URL
 *
 * @param {File|Blob} file
 * @param {string} uploadUrl
 * @returns {Promise<{ ok: boolean, storageKey?: string }>}
 */
export async function uploadFileToStorage(file, uploadUrl) {
  if (!isApiMode()) {
    // Extract storageKey from mock URL
    const storageKey = uploadUrl.replace('mock-upload://', '');
    const existing = _mockStore.get(storageKey);
    if (existing) {
      existing.blob = file instanceof Blob ? file : null;
    }
    return { ok: true, storageKey };
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: file?.type ? { 'Content-Type': file.type } : undefined,
  });
  if (!response.ok) throw new Error('Storage upload failed');
  return { ok: true };
}

/**
 * Request a signed download URL
 *
 * In mock mode: if the file exists in the store, return a blob:// URL
 * created from the stored Blob. In API mode: call backend for signed URL.
 *
 * @param {string} storageKey
 * @returns {Promise<string|null>}
 */
export async function requestSignedDownloadUrl(storageKey) {
  if (!storageKey) return null;

  if (!isApiMode()) {
    const entry = _mockStore.get(storageKey);
    if (!entry) return null;

    // If there's a real Blob, create an object URL
    if (entry.blob) {
      try {
        return URL.createObjectURL(entry.blob);
      } catch {
        return null;
      }
    }

    // Return a mock download URL for display
    return `mock-download://${storageKey}`;
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/presign-download?key=${encodeURIComponent(storageKey)}`
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.downloadUrl || null;
}

/**
 * Delete a stored file
 *
 * @param {string} storageKey
 * @returns {Promise<{ ok: boolean }>}
 */
export async function deleteStoredFile(storageKey) {
  if (!storageKey) return { ok: false };

  if (!isApiMode()) {
    _mockStore.delete(storageKey);
    // Clean up hash registry
    for (const [hash, key] of _hashRegistry) {
      if (key === storageKey) {
        _hashRegistry.delete(hash);
        break;
      }
    }
    return { ok: true };
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/file?key=${encodeURIComponent(storageKey)}`,
    { method: 'DELETE' }
  );
  return { ok: response.ok };
}

/**
 * Get file metadata
 *
 * @param {string} storageKey
 * @returns {Promise<Object|null>}
 */
export async function getFileMetadata(storageKey) {
  if (!storageKey) return null;

  if (!isApiMode()) {
    return _mockStore.get(storageKey) || null;
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/file?key=${encodeURIComponent(storageKey)}`
  );
  if (!response.ok) return null;
  return response.json();
}

/**
 * Validate a file before upload
 *
 * @param {File} file
 * @returns {{ valid: boolean, error?: string, type?: string, size?: number }}
 */
export function validateFileBeforeUpload(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Type check
  const typeAllowed =
    !file.type || ALLOWED_AUDIO_MIME_TYPES.includes(file.type);
  const extAllowed = ALLOWED_AUDIO_EXTENSIONS.test(file.name || '');

  if (!typeAllowed || !extAllowed) {
    return {
      valid: false,
      error: 'Only MP3, WAV, M4A, OGG, WebM audio files or TXT transcripts are allowed.',
    };
  }

  // Size check
  if (file.size > MAX_AI_AUDIO_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${Math.round(MAX_AI_AUDIO_SIZE_BYTES / (1024 * 1024))} MB.`,
      size: file.size,
    };
  }

  return { valid: true, type: file.type, size: file.size };
}

/**
 * Check whether a file already exists by its content hash
 *
 * @param {string} fileHash — hash computed client-side
 * @returns {Promise<{ exists: boolean, storageKey?: string }>}
 */
export async function checkFileExists(fileHash) {
  if (!isApiMode()) {
    const storageKey = _hashRegistry.get(fileHash);
    return {
      exists: Boolean(storageKey),
      storageKey: storageKey || undefined,
    };
  }

  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/storage/check?hash=${encodeURIComponent(fileHash)}`
  );
  if (!response.ok) return { exists: false };
  return response.json();
}

/**
 * Register a file hash → storage key mapping (called after upload)
 *
 * @param {string} fileHash
 * @param {string} storageKey
 */
export function registerFileHash(fileHash, storageKey) {
  if (fileHash && storageKey) {
    _hashRegistry.set(fileHash, storageKey);
  }
}

/**
 * Compute a simple content hash from file metadata
 * (For real dedup, use crypto.subtle.digest('SHA-256', ...) on the actual bytes)
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function computeFileHash(file) {
  if (!file) return '';

  // ★ SAFETY: Only hashes metadata (name + size + date), NOT file content.
  // This is intentional for MVP — reading 400MB into memory would block the UI.
  //   raw = "filename.mp3|421000000|1700000000"  (~80 bytes)
  //
  // For production dedup, use a Web Worker with crypto.subtle.digest('SHA-256')
  // on chunked file bytes. Do NOT call file.arrayBuffer() on the main thread
  // for files > 10MB.
  const raw = `${file.name}|${file.size}|${file.lastModified || 0}`;

  // Try Web Crypto if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(raw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    } catch {
      // fall back to simple hash
    }
  }

  // Simple fallback hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ─── Internal helpers ────────────────────────────────────────────────

function sanitizeFileName(name = 'meeting-file') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

// ─── Legacy alias — backward compatibility ───────────────────────────
export const requestUploadUrl = requestPresignedUploadUrl;

/**
 * Legacy getFileUrl — preserved for backward compatibility
 *
 * @param {string} fileKey
 * @returns {string|null}
 */
export function getFileUrl(fileKey) {
  if (!fileKey) return null;
  if (!isApiMode()) return null;
  return `${runtimeConfig.apiBaseUrl}/storage/file?key=${encodeURIComponent(fileKey)}`;
}
