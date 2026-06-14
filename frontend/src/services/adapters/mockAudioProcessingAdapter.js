import { AUDIO_PROCESSING_ERROR, AUDIO_PROCESSING_STATUS, AUDIO_TARGET_FORMAT, createAudioProcessingJobModel } from '@/domain/models/AudioProcessingJob';

const jobs = new Map();
const jobsByRecord = new Map();
const timers = new Map();

function updateJob(jobId, updates) {
  const existing = jobs.get(jobId);
  if (!existing) return null;
  const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  jobs.set(jobId, next);
  return next;
}

function scheduleMockProgress(jobId) {
  const steps = [
    { delay: 350, status: AUDIO_PROCESSING_STATUS.PROCESSING, progress: 20 },
    { delay: 900, status: AUDIO_PROCESSING_STATUS.CONVERTING, progress: 50 },
    { delay: 1450, status: AUDIO_PROCESSING_STATUS.UPLOADING, progress: 80 },
    { delay: 2000, status: AUDIO_PROCESSING_STATUS.COMPLETED, progress: 100 },
  ];

  const handles = steps.map((step) => setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job || [AUDIO_PROCESSING_STATUS.CANCELLED, AUDIO_PROCESSING_STATUS.FAILED].includes(job.status)) return;
    const completed = step.status === AUDIO_PROCESSING_STATUS.COMPLETED;
    updateJob(jobId, {
      status: step.status,
      progress: step.progress,
      outputFileName: completed ? `${job.sourceTitle || 'voice-recording'}.mp3` : job.outputFileName,
      outputObjectUrl: completed ? job.sourceObjectUrl : job.outputObjectUrl,
      targetFormat: AUDIO_TARGET_FORMAT.MP3,
      completedAt: completed ? new Date().toISOString() : null,
    });
  }, step.delay));

  timers.set(jobId, handles);
}

export async function createAudioProcessingJob(record, targetFormat = AUDIO_TARGET_FORMAT.MP3) {
  const recordJobs = jobsByRecord.get(record.id) || [];
  const reusable = recordJobs
    .map((jobId) => jobs.get(jobId))
    .find((job) => job?.targetFormat === targetFormat && job.status === AUDIO_PROCESSING_STATUS.COMPLETED);
  if (reusable) return reusable;

  const job = createAudioProcessingJobModel({
    id: `audio-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: record.workspaceId,
    sourceRecordId: record.id,
    sourceStorageKey: record.storageKey || null,
    sourceObjectUrl: record.objectUrl || null,
    sourceFormat: record.format,
    sourceTitle: record.title,
    targetFormat,
    createdBy: record.recordedBy,
  });

  jobs.set(job.id, job);
  jobsByRecord.set(record.id, [...recordJobs, job.id]);
  scheduleMockProgress(job.id);
  return job;
}

export async function getAudioProcessingJob(jobId) {
  return jobs.get(jobId) || null;
}

export async function getJobsByRecord(recordId) {
  return (jobsByRecord.get(recordId) || []).map((jobId) => jobs.get(jobId)).filter(Boolean);
}

export async function retryAudioProcessingJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.retryCount >= job.maxRetries) {
    return updateJob(jobId, {
      status: AUDIO_PROCESSING_STATUS.FAILED,
      errorCode: AUDIO_PROCESSING_ERROR.CONVERSION_FAILED,
      errorMessage: 'MP3 conversion failed. Please try again.',
    });
  }
  const retried = updateJob(jobId, {
    status: AUDIO_PROCESSING_STATUS.QUEUED,
    progress: 0,
    retryCount: job.retryCount + 1,
    errorCode: null,
    errorMessage: null,
  });
  scheduleMockProgress(jobId);
  return retried;
}

export async function cancelAudioProcessingJob(jobId) {
  (timers.get(jobId) || []).forEach(clearTimeout);
  timers.delete(jobId);
  return updateJob(jobId, {
    status: AUDIO_PROCESSING_STATUS.CANCELLED,
    errorCode: AUDIO_PROCESSING_ERROR.CANCELLED_BY_USER,
    errorMessage: 'Conversion cancelled.',
  });
}
