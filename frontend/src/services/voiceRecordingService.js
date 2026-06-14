/**
 * VoiceRecordingService — local-first voice recording with explicit upload/AI
 *
 * Key principle: recordings stay local (Blob URL) after stop.
 * No auto-upload to cloud. No auto-send to AI.
 * User must explicitly click "Save to Cloud" or "Send to AI".
 *
 * Local playback is always free — no AWS cost involved.
 */

import { isApiMode } from '@/config/runtimeConfig';
import * as mockAdapter from '@/services/adapters/mockVoiceRecordingAdapter';
import * as apiAdapter from '@/services/adapters/apiVoiceRecordingAdapter';
import {
  MAX_AI_AUDIO_SIZE_BYTES,
  WARNING_AI_AUDIO_SIZE_BYTES,
} from '@/domain/constants/costConstants';

const adapter = isApiMode() ? apiAdapter : mockAdapter;

// ─── In-memory local record store ───────────────────────────────────
/** @type {Map<string, { id: string, blob: Blob, blobUrl: string, metadata: Object, savedToCloud: boolean, sentToAi: boolean }>} */
const _localRecords = new Map();

let _recordIdCounter = 0;

/**
 * Create a local voice record (no upload, no cloud cost)
 *
 * After recording stops, the blob stays in browser memory.
 * Caller should revoke the blob URL when the record is dismissed.
 *
 * @param {Blob} blob — recorded audio blob
 * @param {Object} [metadata={}]
 * @param {string} [metadata.channelId]
 * @param {string} [metadata.userId]
 * @param {string} [metadata.workspaceId]
 * @returns {{ id: string, blobUrl: string, metadata: Object }}
 */
export function createLocalRecord(blob, metadata = {}) {
  _recordIdCounter += 1;
  const id = `local-record-${Date.now()}-${_recordIdCounter}`;
  const blobUrl = URL.createObjectURL(blob);

  const record = {
    id,
    blob,
    blobUrl,
    metadata: {
      ...metadata,
      fileName: metadata.fileName || `voice-record-${id.slice(0, 8)}.webm`,
      fileSize: blob.size,
      mimeType: blob.type || 'audio/webm',
      duration: metadata.duration || 0,
      createdAt: new Date().toISOString(),
    },
    savedToCloud: false,
    sentToAi: false,
  };

  _localRecords.set(id, record);
  return { id, blobUrl, metadata: record.metadata };
}

/**
 * Get a local record by ID
 *
 * @param {string} recordId
 * @returns {Object|null}
 */
export function getLocalRecord(recordId) {
  return _localRecords.get(recordId) || null;
}

/**
 * Revoke a local record's blob URL and remove from store
 *
 * Always call this when the record is dismissed to free memory.
 *
 * @param {string} recordId
 */
export function discardLocalRecord(recordId) {
  const record = _localRecords.get(recordId);
  if (record) {
    URL.revokeObjectURL(record.blobUrl);
    _localRecords.delete(recordId);
  }
}

/**
 * Check whether a record can be sent to AI
 *
 * @param {Object} record — local record object
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canSendToAI(record) {
  if (!record) {
    return { allowed: false, reason: 'No recording found.' };
  }

  const size = record.metadata?.fileSize || record.blob?.size || 0;

  if (size > MAX_AI_AUDIO_SIZE_BYTES) {
    return {
      allowed: false,
      reason: `Recording too large for AI processing. Maximum is ${Math.round(MAX_AI_AUDIO_SIZE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  if (record.sentToAi) {
    return { allowed: false, reason: 'Already sent to AI.' };
  }

  return { allowed: true };
}

/**
 * Estimate AI cost for a voice record based on size
 *
 * @param {Object} record — local record object
 * @returns {{ estimatedCost: string, estimatedCents: number, warning: boolean }}
 */
export function estimateAiCostForRecord(record) {
  const size = record?.metadata?.fileSize || record?.blob?.size || 0;
  const sizeMB = size / (1024 * 1024);

  if (sizeMB < 10) {
    return { estimatedCost: '~Low', estimatedCents: 1, warning: false };
  }
  if (sizeMB < 100) {
    return { estimatedCost: '~Medium', estimatedCents: 5, warning: false };
  }
  return { estimatedCost: '~High', estimatedCents: 15, warning: sizeMB > WARNING_AI_AUDIO_SIZE_BYTES / (1024 * 1024) };
}

/**
 * Upload a local record to cloud storage
 *
 * @param {string} recordId
 * @returns {Promise<{ ok: boolean, remoteId?: string, error?: string }>}
 */
export async function uploadRecordToCloud(recordId) {
  const record = _localRecords.get(recordId);
  if (!record) {
    return { ok: false, error: 'Local recording not found.' };
  }

  if (record.savedToCloud) {
    return { ok: true, error: 'Already saved to cloud.' };
  }

  if (!isApiMode()) {
    // Mock: mark as saved, don't actually upload
    record.savedToCloud = true;
    return {
      ok: true,
      remoteId: `cloud-record-${recordId}`,
    };
  }

  // Real mode: upload blob to backend
  const result = await adapter.uploadVoiceRecord(recordId, record.blob);
  if (result?.id) {
    record.savedToCloud = true;
    return { ok: true, remoteId: result.id };
  }
  return { ok: false, error: 'Upload failed.' };
}

/**
 * Send a local record to AI processing (chains upload + AI)
 *
 * @param {string} recordId
 * @returns {Promise<{ ok: boolean, jobId?: string, error?: string }>}
 */
export async function sendRecordToAiProcessing(recordId) {
  const record = _localRecords.get(recordId);
  if (!record) {
    return { ok: false, error: 'Local recording not found.' };
  }

  // Check if already sent
  if (record.sentToAi) {
    return { ok: false, error: 'This recording has already been sent to AI.' };
  }

  // Check size
  const check = canSendToAI(record);
  if (!check.allowed) {
    return { ok: false, error: check.reason };
  }

  // Upload to cloud first if not already saved
  if (!record.savedToCloud) {
    const uploadResult = await uploadRecordToCloud(recordId);
    if (!uploadResult.ok) {
      return { ok: false, error: 'Failed to upload recording before AI processing.' };
    }
  }

  if (!isApiMode()) {
    // Mock: mark as sent to AI
    record.sentToAi = true;
    return {
      ok: true,
      jobId: `mock-ai-job-${recordId}`,
    };
  }

  // Real mode: call adapter
  const result = await adapter.sendVoiceRecordToAI(recordId);
  if (result?.jobId) {
    record.sentToAi = true;
    return { ok: true, jobId: result.jobId };
  }
  return { ok: false, error: 'AI processing request failed.' };
}

// ─── Legacy adapter passthroughs ─────────────────────────────────────
export const createVoiceRecord = (recordData) => adapter.createVoiceRecord(recordData);
export const getVoiceRecordsByChannel = (workspaceId, channelId) =>
  adapter.getVoiceRecordsByChannel(workspaceId, channelId);
export const deleteVoiceRecord = (recordId) => adapter.deleteVoiceRecord(recordId);

/**
 * Legacy sendVoiceRecordToAI — now delegates to new local-first flow
 *
 * @param {string} recordId
 * @returns {Promise<*>}
 */
export async function sendVoiceRecordToAI(recordId) {
  const result = await sendRecordToAiProcessing(recordId);
  return result;
}
