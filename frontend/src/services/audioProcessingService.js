import { AUDIO_TARGET_FORMAT } from '@/domain/models/AudioProcessingJob';

/*
Production audio pipeline:
Browser MediaRecorder -> record WebM/Opus -> upload WebM to S3 by presigned URL
-> create audio processing job -> SQS/EventBridge -> ECS/Fargate ffmpeg worker
-> convert WebM to MP3 -> upload MP3 to S3 -> update job completed
-> frontend polls/subscribes to job status.

Do not upload 400MB audio through a Next.js API route, expose AWS credentials
to the browser, or ship ffmpeg in the client bundle.
*/

export function createAudioProcessingJob(_record, targetFormat = AUDIO_TARGET_FORMAT.MP3) {
  throw new Error(`Audio conversion to ${targetFormat} requires the AWS audio-processing worker. Use Auto-transcribe & Analyze on the original S3 recording.`);
}

export const getAudioProcessingJob = () => null;
export const getJobsByRecord = () => [];
export const retryAudioProcessingJob = () => {
  throw new Error('Audio conversion worker is not deployed.');
};
export const cancelAudioProcessingJob = () => {
  throw new Error('Audio conversion worker is not deployed.');
};
