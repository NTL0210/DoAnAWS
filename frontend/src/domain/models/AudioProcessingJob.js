export const AUDIO_PROCESSING_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  CONVERTING: 'CONVERTING',
  UPLOADING: 'UPLOADING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const AUDIO_TARGET_FORMAT = Object.freeze({
  MP3: 'MP3',
  WEBM: 'WEBM',
  M4A: 'M4A',
});

export const AUDIO_PROCESSING_ERROR = Object.freeze({
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  JOB_TIMEOUT: 'JOB_TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CANCELLED_BY_USER: 'CANCELLED_BY_USER',
});

export function createAudioProcessingJobModel(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || `audio-job-${Date.now()}`,
    workspaceId: overrides.workspaceId || null,
    sourceRecordId: overrides.sourceRecordId || null,
    sourceStorageKey: overrides.sourceStorageKey || null,
    sourceObjectUrl: overrides.sourceObjectUrl || null,
    sourceFormat: overrides.sourceFormat || null,
    sourceTitle: overrides.sourceTitle || null,
    targetFormat: overrides.targetFormat || AUDIO_TARGET_FORMAT.MP3,
    outputStorageKey: overrides.outputStorageKey || null,
    outputObjectUrl: overrides.outputObjectUrl || null,
    outputFileName: overrides.outputFileName || null,
    status: overrides.status || AUDIO_PROCESSING_STATUS.QUEUED,
    progress: overrides.progress || 0,
    retryCount: overrides.retryCount || 0,
    maxRetries: overrides.maxRetries ?? 3,
    errorCode: overrides.errorCode || null,
    errorMessage: overrides.errorMessage || null,
    createdBy: overrides.createdBy || null,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    completedAt: overrides.completedAt || null,
  };
}
