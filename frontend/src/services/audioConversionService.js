/**
 * AudioConversionService — MP3 conversion job interface.
 *
 * Architecture intent:
 *   Browser records WebM/Opus → frontend creates conversion job →
 *   backend (ffmpeg worker) processes → frontend polls status →
 *   user downloads MP3.
 *
 * Currently in mock mode: no real conversion, no fake .mp3 extension changes.
 * The mock simulates job lifecycle for UI development.
 * Replace adapter with real backend calls when the conversion worker is built.
 *
 * Reference: https://github.com/NTL0210/Ytomp34 (architecture ideas only)
 */

import { isApiMode } from '@/config/runtimeConfig';

import * as mockAdapter from '@/services/adapters/mockAudioProcessingAdapter';
import * as apiAdapter from '@/services/adapters/apiAudioProcessingAdapter';

const adapter = isApiMode() ? apiAdapter : mockAdapter;

/** @type {Map<string, Object>} */
const _jobCache = new Map();

/**
 * Create a conversion job.
 *
 * @param {Object} record - Voice record { id, blob, fileName, mimeType, objectUrl }
 * @param {string} targetFormat - e.g. 'MP3'
 * @returns {Promise<Object>} Job { id, recordId, sourceFormat, targetFormat, status, progress, outputFileName, outputObjectUrl, errorMessage }
 */
export async function createAudioProcessingJob(record, targetFormat = 'MP3') {
  const job = await adapter.createAudioProcessingJob(record, targetFormat);
  if (job?.id) _jobCache.set(job.id, job);
  return job;
}

/**
 * Get job status by ID.
 *
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
export async function getAudioProcessingJob(jobId) {
  const cached = _jobCache.get(jobId);
  if (cached && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(cached.status)) {
    return cached;
  }
  const job = await adapter.getAudioProcessingJob(jobId);
  if (job) _jobCache.set(job.id, job);
  return job;
}

/**
 * Get all jobs for a record.
 *
 * @param {string} recordId
 * @returns {Promise<Object[]>}
 */
export function getJobsByRecord(recordId) {
  return adapter.getJobsByRecord(recordId);
}

/**
 * Retry a failed job.
 *
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
export async function retryAudioProcessingJob(jobId) {
  const job = await adapter.retryAudioProcessingJob(jobId);
  if (job) _jobCache.set(job.id, job);
  return job;
}

/**
 * Cancel a queued/processing job.
 *
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
export async function cancelAudioProcessingJob(jobId) {
  const job = await adapter.cancelAudioProcessingJob(jobId);
  if (job) _jobCache.set(job.id, job);
  return job;
}
