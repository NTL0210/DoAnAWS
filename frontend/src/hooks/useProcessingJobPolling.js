/**
 * useProcessingJobPolling — adaptive polling for async processing jobs
 *
 * Polling strategy (adaptive backoff):
 *   0 s – 30 s:     every 5 s
 *   30 s – 5 min:   every 15 s
 *   5 min +:        every 30 s (or 60 s when tab hidden)
 *
 * Stops when status reaches a terminal state (COMPLETED / FAILED / CANCELLED).
 * Pauses when the browser tab is hidden (visibilitychange).
 * Max 20 consecutive errors before giving up.
 * Cleanup on unmount.
 *
 * Usage:
 *   const { status, progress, polling, elapsedMs } = useProcessingJobPolling(jobId, {
 *     enabled: true,
 *     onComplete: (result) => { /* update UI * / },
 *     onError: (error) => { /* show error * / },
 *   });
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getProcessingJobStatus, getJobByMeeting } from '@/services/meetingProcessingService';
import { TERMINAL_JOB_STATUSES, POLLING_INTERVALS } from '@/domain/constants/costConstants';

/**
 * @typedef {Object} PollingState
 * @property {string|null} status — current job status
 * @property {number} progress — progress percentage (0-100)
 * @property {Object|null} result — job result when completed
 * @property {string|null} error — error message if failed
 * @property {boolean} polling — whether polling is active
 * @property {number} elapsedMs — elapsed time since polling started
 * @property {Function} refetch — manually trigger a poll
 * @property {Function} cancel — stop polling
 */

/**
 * @param {string|null} jobId — the job ID to poll (null = disabled)
 * @param {Object} [options={}]
 * @param {string} [options.meetingId] — alternative to jobId, looks up job by meeting
 * @param {boolean} [options.enabled=true] — start/stop polling
 * @param {Function} [options.onComplete] — called with (result) when COMPLETED
 * @param {Function} [options.onError] — called with (error) when FAILED
 * @param {Function} [options.onStatusChange] — called with (status) on every change
 * @returns {PollingState}
 */
export default function useProcessingJobPolling(jobId, options = {}) {
  const {
    meetingId,
    enabled = true,
    onComplete,
    onError,
    onStatusChange,
  } = options;

  // ── State ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);

  // ── Refs (avoid stale closures) ────────────────────────────────────
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const elapsedRef = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const consecutiveErrorsRef = useRef(0);
  const lastStatusRef = useRef(null);
  const isCancelledRef = useRef(false);

  const MAX_CONSECUTIVE_ERRORS = 20;

  // Correct resolved ID to poll
  const resolvedJobId = jobId || meetingId || null;

  // ── Compute interval based on elapsed time ─────────────────────────
  function getInterval() {
    const isHidden = typeof document !== 'undefined' && document.hidden;
    if (isHidden) return POLLING_INTERVALS.background;

    const elapsed = elapsedRef.current;
    if (elapsed < 30000) return POLLING_INTERVALS.initial;      // 0-30s: 5s
    if (elapsed < 300000) return POLLING_INTERVALS.medium;      // 30s-5min: 15s
    return POLLING_INTERVALS.slow;                               // 5min+: 30s
  }

  // ── Single poll ────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (isCancelledRef.current || !resolvedJobId) return;

    try {
      let job;
      if (jobId) {
        job = await getProcessingJobStatus(jobId);
      } else if (meetingId) {
        job = await getJobByMeeting(meetingId);
      }

      if (!job) {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          setError('Polling stopped: job not found after multiple attempts.');
          setPolling(false);
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      // Reset error counter on success
      consecutiveErrorsRef.current = 0;

      // Update state
      if (job.status !== lastStatusRef.current) {
        lastStatusRef.current = job.status;
        onStatusChange?.(job.status);
      }

      setStatus(job.status);
      setProgress(job.progress || 0);

      // Terminal states
      if (TERMINAL_JOB_STATUSES.includes(job.status)) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setPolling(false);

        if (job.status === 'COMPLETED') {
          setResult(job.result || job);
          onComplete?.(job.result || job);
        } else if (job.status === 'FAILED') {
          setError(job.error || 'Processing failed.');
          onError?.(job.error || 'Processing failed.');
        }
        // CANCELLED: just stop
      }
    } catch (err) {
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        setError(`Polling stopped: ${err.message || 'Too many errors'}`);
        setPolling(false);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [jobId, meetingId, resolvedJobId, onComplete, onError, onStatusChange]);

  // ── Start / stop polling ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !resolvedJobId) {
      // Cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPolling(false);
      return;
    }

    // Reset state for new job
    isCancelledRef.current = false;
    consecutiveErrorsRef.current = 0;
    lastStatusRef.current = null;
    startTimeRef.current = Date.now();
    elapsedRef.current = 0;

    // Initial poll
    poll();
    setPolling(true);

    // Start interval (re-evaluates each tick)
    intervalRef.current = setInterval(() => {
      elapsedRef.current = Date.now() - (startTimeRef.current || Date.now());
      poll();
    }, getInterval());

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // Only depend on enabled/resolvedJobId — the lifecycle of polling (start/stop).
    // poll() is a useCallback with its own deps (jobId, meetingId, callbacks).
    // getInterval() depends only on elapsedRef (ref) and POLLING_INTERVALS (const), both stable.
    // Adding poll/getInterval as deps would restart the interval timer on every callback change
    // without actually starting a new job, losing the adaptive timing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resolvedJobId]);

  // ── Tab visibility handling ────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !resolvedJobId) return;

    function handleVisibilityChange() {
      if (intervalRef.current) {
        // Restart interval with new timing
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          elapsedRef.current = Date.now() - (startTimeRef.current || Date.now());
          poll();
        }, getInterval());
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, resolvedJobId, poll]);

  // ── Elapsed time counter ───────────────────────────────────────────
  useEffect(() => {
    if (!polling) return;

    const timer = setInterval(() => {
      const e = Date.now() - (startTimeRef.current || Date.now());
      elapsedRef.current = e;
      setElapsedMs(e);
    }, 1000);

    return () => clearInterval(timer);
  }, [polling]);

  // ── Manual controls ────────────────────────────────────────────────
  const refetch = useCallback(() => {
    poll();
  }, [poll]);

  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPolling(false);
    setStatus('CANCELLED');
  }, []);

  return {
    status,
    progress,
    result,
    error,
    polling,
    elapsedMs,
    refetch,
    cancel,
  };
}
