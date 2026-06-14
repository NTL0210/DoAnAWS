import { runtimeConfig } from '@/config/runtimeConfig';

async function request(path, options = {}) {
  const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error('Network error while checking conversion status.');
  return response.json();
}

export function createAudioProcessingJob(record, targetFormat) {
  return request('/audio-processing/jobs', {
    method: 'POST',
    body: JSON.stringify({ recordId: record.id, targetFormat }),
  });
}

export function getAudioProcessingJob(jobId) {
  return request(`/audio-processing/jobs/${jobId}`);
}

export function getJobsByRecord(recordId) {
  return request(`/audio-processing/jobs?recordId=${encodeURIComponent(recordId)}`);
}

export function retryAudioProcessingJob(jobId) {
  return request(`/audio-processing/jobs/${jobId}/retry`, { method: 'POST' });
}

export function cancelAudioProcessingJob(jobId) {
  return request(`/audio-processing/jobs/${jobId}/cancel`, { method: 'POST' });
}
