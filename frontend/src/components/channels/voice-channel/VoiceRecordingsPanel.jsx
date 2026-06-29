'use client';

import React from 'react';

/**
 * VoiceRecordingsPanel — displays recorded audio with playback, download,
 * conversion, send-to-AI, and delete actions.
 *
 * Props:
 *   records - array of recording objects
 *   formatDuration(seconds) - number → "M:SS"
 *   formatFileSize(bytes) - number → "1.2 MB"
 *   formatAudioFormat(format) - string → human-readable
 *   processingJobs - dict of {recordId: jobInfo}
 *   playbackGainByRecord - dict of {recordId: gain}
 *   setPlaybackGainByRecord - setter for the above
 *   maxVoiceRecordingSizeBytes - cap for AI send (bytes)
 *   warningVoiceRecordingSizeBytes - warning threshold (bytes)
 *   AUDIO_PROCESSING_STATUS - { QUEUED, PROCESSING, CONVERTING, UPLOADING, COMPLETED, FAILED }
 *   extensionMatchesMime(fileName, mime) - boolean helper
 *   onDownload(record) - download original
 *   onConvertToMp3(record) - start MP3 conversion
 *   onCancelConversion(jobId) - cancel a running job
 *   onRetryConversion(jobId) - retry a failed job
 *   onSendToAI(recordId) - send recording to AI processing
 *   onDelete(record) - prompt delete (set pending delete)
 *   canManagePermissions - boolean
 */
export default function VoiceRecordingsPanel({
  records,
  formatDuration,
  formatFileSize,
  formatAudioFormat,
  processingJobs,
  playbackGainByRecord,
  setPlaybackGainByRecord,
  maxVoiceRecordingSizeBytes,
  warningVoiceRecordingSizeBytes,
  AUDIO_PROCESSING_STATUS,
  extensionMatchesMime,
  onDownload,
  onConvertToMp3,
  onCancelConversion,
  onRetryConversion,
  onSendToAI,
  onDelete,
  canManagePermissions,
}) {
  if (!records || records.length === 0) {
    return (
      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Recent Recordings
          </h3>
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
            0 records
          </span>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-5 py-8 text-center">
          <svg className="mx-auto h-7 w-7 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-sm font-black text-slate-600 dark:text-slate-300">
            No recordings yet
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Completed recordings will appear here with playback, download, and AI actions.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Recent Recordings
        </h3>
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
          {records.length} {records.length === 1 ? 'record' : 'records'}
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {records.map((record) => {
          const tooLargeForAI = record.sizeBytes > maxVoiceRecordingSizeBytes;
          const nearAiLimit = record.sizeBytes > warningVoiceRecordingSizeBytes;
          const job = processingJobs?.[record.id];
          const originalIsMp3 = record.format?.includes('mpeg') || record.fileName?.toLowerCase().endsWith('.mp3');
          const mp3Ready = originalIsMp3 || job?.status === AUDIO_PROCESSING_STATUS?.COMPLETED;
          const extensionMismatch = !extensionMatchesMime?.(record.fileName, record.format || record.mimeType);
          const gain = playbackGainByRecord?.[record.id] ?? 0.85;
          const jobRunning = job && [
            AUDIO_PROCESSING_STATUS?.QUEUED,
            AUDIO_PROCESSING_STATUS?.PROCESSING,
            AUDIO_PROCESSING_STATUS?.CONVERTING,
            AUDIO_PROCESSING_STATUS?.UPLOADING,
          ].includes(job.status);
          const jobFailed = job?.status === AUDIO_PROCESSING_STATUS?.FAILED;

          return (
            <article
              key={record.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">
                    {record.title}
                  </h4>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {formatDuration?.(record.durationSeconds) || record.durationSeconds + 's'} -{' '}
                    {formatFileSize?.(record.sizeBytes) || record.sizeBytes + ' B'} -{' '}
                    {formatAudioFormat?.(record.format) || record.format || 'Unknown'}
                    {record.bitrate ? ` - ${Math.round(record.bitrate / 1000)} kbps` : ''}
                  </p>
                  {record.peakLevel != null && (
                    <p
                      className={`mt-1 text-[11px] font-bold ${
                        record.peakLevel >= 0.98 || record.clippingFrames > 2
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      Rec peak {record.peakLevel.toFixed(3)} - raw peak{' '}
                      {(record.rawPeak ?? 0).toFixed(3)} - chunks{' '}
                      {record.chunkCount ?? 0} - clipping frames{' '}
                      {record.clippingFrames ?? 0}
                    </p>
                  )}
                </div>
                {record.autoStopped && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600">
                    Auto stopped
                  </span>
                )}
              </div>

              {/* Audio player */}
              {record.objectUrl ? (
                <div className="mt-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3">
                  <audio
                    className="w-full"
                    controls
                    src={record.objectUrl}
                    type={record.format || record.mimeType}
                    ref={(node) => {
                      if (node) node.volume = Math.max(0, Math.min(1, gain));
                    }}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>Preview volume</span>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      value={Math.round(gain * 100)}
                      onChange={(event) => {
                        const value = Number(event.target.value) / 100;
                        setPlaybackGainByRecord?.((prev) => ({
                          ...prev,
                          [record.id]: value,
                        }));
                      }}
                      className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700 accent-blue-500"
                    />
                    <span>{Math.round(gain * 100)}%</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPlaybackGainByRecord?.((prev) => ({
                          ...prev,
                          [record.id]: 1.2,
                        }))
                      }
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Normalize preview
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Audio object is not available.
                </div>
              )}

              {/* Warnings */}
              {extensionMismatch && (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  File extension does not match the recorded MIME type.
                </p>
              )}
              {tooLargeForAI && (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  Recording exceeds {formatFileSize?.(maxVoiceRecordingSizeBytes) || '400MB'} and cannot be sent to AI.
                </p>
              )}
              {nearAiLimit && !tooLargeForAI && (
                <p className="mt-2 text-xs font-semibold text-amber-600">
                  Large recording warning: AI processing may be slower near{' '}
                  {formatFileSize?.(maxVoiceRecordingSizeBytes) || '400MB'}.
                </p>
              )}
              {record.format?.includes('webm') && (
                <p className="mt-2 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
                  Browser recording uses WebM/Opus. Convert to MP3 later by backend if needed.
                </p>
              )}

              {/* Conversion job progress */}
              {job && (
                <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-slate-400">
                    <span>MP3 conversion: {job.status}</span>
                    <span>{job.progress || 0}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>
                  {jobFailed && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">
                      {job.errorMessage || 'MP3 conversion failed. Please try again.'}
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Download original */}
                <button
                  type="button"
                  disabled={!record.objectUrl}
                  onClick={() => onDownload?.(record)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Original
                </button>

                {/* Download / Convert MP3 */}
                {mp3Ready ? (
                  <button
                    type="button"
                    disabled={!record.objectUrl && !job?.outputObjectUrl}
                    onClick={() => onDownload?.({
                      ...record,
                      _mp3Url: originalIsMp3 ? record.objectUrl : job?.outputObjectUrl,
                      _mp3Name: originalIsMp3 ? record.fileName : job?.outputFileName || `${record.title}.mp3`,
                    })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download MP3
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={jobRunning}
                    onClick={() => onConvertToMp3?.(record)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0l-10.5 3m10.5-3v11.25M9 9v11.25M9 9l10.5-3M9 9l-3 1.5M9 9l3 1.5M21 12v3.75M9 20.25V21M9 20.25L3 18.75v-7.5L9 12m0 8.25l6-2.25V12M9 20.25l-3 1.125" />
                    </svg>
                    Convert to MP3
                  </button>
                )}

                {/* Cancel job */}
                {jobRunning && (
                  <button
                    type="button"
                    onClick={() => onCancelConversion?.(job.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                )}

                {/* Retry job */}
                {jobFailed && (
                  <button
                    type="button"
                    onClick={() => onRetryConversion?.(job.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100"
                  >
                    Retry
                  </button>
                )}

                {/* Send to AI — auto-transcribe + summarize */}
                <button
                  type="button"
                  disabled={tooLargeForAI || record.aiStatus === 'SENT_TO_AI'}
                  onClick={() => onSendToAI?.(record.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Automatically transcribe speech-to-text and analyze with AI"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  {record.aiStatus === 'SENT_TO_AI'
                    ? 'Sent to AI'
                    : 'Auto-transcribe & Analyze'}
                </button>

                {/* Delete */}
                {canManagePermissions && (
                  <button
                    type="button"
                    onClick={() => onDelete?.(record)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
