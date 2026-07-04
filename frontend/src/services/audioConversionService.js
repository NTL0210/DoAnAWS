/**
 * AudioConversionService — MP3 conversion job interface.
 *
 * Architecture intent:
 *   Browser records WebM/Opus → frontend creates conversion job →
 *   backend (ffmpeg worker) processes → frontend polls status →
 *   user downloads MP3.
 *
 * Reference: https://github.com/NTL0210/Ytomp34 (architecture ideas only)
 */

import * as apiAdapter from '@/services/adapters/apiAudioProcessingAdapter';

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
  const job = await apiAdapter.createAudioProcessingJob(record, targetFormat);
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
  const job = await apiAdapter.getAudioProcessingJob(jobId);
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
  return apiAdapter.getJobsByRecord(recordId);
}

/**
 * Retry a failed job.
 *
 * @param {string} jobId
 * @returns {Promise<Object|null>}
 */
export async function retryAudioProcessingJob(jobId) {
  const job = await apiAdapter.retryAudioProcessingJob(jobId);
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
  const job = await apiAdapter.cancelAudioProcessingJob(jobId);
  if (job) _jobCache.set(job.id, job);
  return job;
}
