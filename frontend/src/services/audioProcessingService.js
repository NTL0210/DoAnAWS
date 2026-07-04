import { AUDIO_TARGET_FORMAT } from '@/domain/models/AudioProcessingJob';
import * as apiAdapter from '@/services/adapters/apiAudioProcessingAdapter';

/*
Production audio pipeline:
Browser MediaRecorder -> record WebM/Opus -> upload WebM to S3 by presigned URL
-> create audio processing job -> SQS/EventBridge -> ECS/Fargate ffmpeg worker
-> convert WebM to MP3 -> upload MP3 to S3 -> update job completed
-> frontend polls/subscribes to job status.

Do not upload 400MB audio through a Next.js API route, expose AWS credentials
to the browser, or ship ffmpeg in the client bundle.
*/

export function createAudioProcessingJob(record, targetFormat = AUDIO_TARGET_FORMAT.MP3) {
  return apiAdapter.createAudioProcessingJob(record, targetFormat);
}

export const getAudioProcessingJob = (jobId) => apiAdapter.getAudioProcessingJob(jobId);
export const getJobsByRecord = (recordId) => apiAdapter.getJobsByRecord(recordId);
export const retryAudioProcessingJob = (jobId) => apiAdapter.retryAudioProcessingJob(jobId);
export const cancelAudioProcessingJob = (jobId) => apiAdapter.cancelAudioProcessingJob(jobId);
