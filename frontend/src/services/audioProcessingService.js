import { isApiMode } from '@/config/runtimeConfig';
import { AUDIO_TARGET_FORMAT } from '@/domain/models/AudioProcessingJob';
import * as mockAdapter from '@/services/adapters/mockAudioProcessingAdapter';
import * as apiAdapter from '@/services/adapters/apiAudioProcessingAdapter';

const adapter = isApiMode() ? apiAdapter : mockAdapter;

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
  return adapter.createAudioProcessingJob(record, targetFormat);
}

export const getAudioProcessingJob = (jobId) => adapter.getAudioProcessingJob(jobId);
export const getJobsByRecord = (recordId) => adapter.getJobsByRecord(recordId);
export const retryAudioProcessingJob = (jobId) => adapter.retryAudioProcessingJob(jobId);
export const cancelAudioProcessingJob = (jobId) => adapter.cancelAudioProcessingJob(jobId);
export const mockConvertToMp3 = (record) => mockAdapter.createAudioProcessingJob(record, AUDIO_TARGET_FORMAT.MP3);
