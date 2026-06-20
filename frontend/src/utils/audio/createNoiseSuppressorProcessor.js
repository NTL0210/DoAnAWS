'use client';

import { createVoiceProcessedStream } from './createVoiceProcessedStream';
import { createDtlnNoiseSuppressedStream } from './createDtlnNoiseSuppressedStream';
import { createAecProcessedStream } from './createAecProcessedStream';

/**
 * createNoiseSuppressorProcessor — orchestrates noise suppression + AEC.
 *
 * @param {MediaStream} rawStream
 * @param {Object} [options]
 * @param {string} [options.noiseSuppressionMode] — see VOICE_NOISE_SUPPRESSION_MODES
 * @param {boolean} [options.aecEnabled] — enable Acoustic Echo Cancellation
 * @param {MediaStream} [options.farEndStream] — remote playback stream for AEC reference
 * @returns {Promise<Object>} { stream, cleanup, pushFarEnd, ... }
 */
export async function createNoiseSuppressorProcessor(rawStream, options = {}) {
  const mode = options.noiseSuppressionMode || options.mode || 'browser-plus-webaudio';
  const aecEnabled = options.aecEnabled === true;

  if (!rawStream) {
    return { stream: null, cleanup: () => {}, context: null, nodes: {}, getStats: () => ({}) };
  }

  // ─── Step 1: Noise suppression ────────────────────────────
  let processedResult;
  switch (mode) {
    case 'off':
    case 'browser-only':
      processedResult = { stream: rawStream, cleanup: () => {}, context: null, nodes: {}, getStats: () => ({ mode }) };
      break;
    case 'browser-plus-webaudio':
      processedResult = await createVoiceProcessedStream(rawStream, { ...options, enabled: true });
      break;
    case 'dtln-ai':
    case 'future-rnnoise':
    case 'future-krisp':
      try {
        processedResult = await createDtlnNoiseSuppressedStream(rawStream, options);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Voice] DTLN unavailable, using Web Audio fallback:', error.message);
        }
        processedResult = await createVoiceProcessedStream(rawStream, { ...options, enabled: true, fallbackFrom: mode });
      }
      break;
    default:
      processedResult = { stream: rawStream, cleanup: () => {}, context: null, nodes: {}, getStats: () => ({ mode: 'raw-fallback' }) };
  }

  // ─── Step 2: AEC (if enabled, wrap the noise-suppressed stream) ──
  if (aecEnabled && processedResult.stream) {
    try {
      const aecResult = await createAecProcessedStream(
        processedResult.stream,
        processedResult.context || null,
        { enabled: true, ...options }
      );

      // Merge cleanup: both noise suppression and AEC
      const originalCleanup = processedResult.cleanup;
      const aecCleanup = aecResult.cleanup;
      const originalGetStats = processedResult.getStats;

      return {
        stream: aecResult.stream,
        context: aecResult.context || processedResult.context,
        nodes: { ...processedResult.nodes, aec: aecResult.nodes },
        pushFarEnd: aecResult.pushFarEnd,
        getStats: () => ({
          ...(originalGetStats?.() || {}),
          aec: aecResult.getStats?.(),
        }),
        cleanup: () => {
          originalCleanup();
          aecCleanup();
        },
      };
    } catch (aecError) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Voice] AEC unavailable, continuing without:', aecError.message);
      }
    }
  }

  return processedResult;
}
