'use client';

import { createVoiceProcessedStream } from './createVoiceProcessedStream';
import { createDtlnNoiseSuppressedStream } from './createDtlnNoiseSuppressedStream';

export async function createNoiseSuppressorProcessor(rawStream, options = {}) {
  const mode = options.noiseSuppressionMode || options.mode || 'browser-plus-webaudio';

  switch (mode) {
    case 'off':
    case 'browser-only':
      return { stream: rawStream, cleanup: () => {}, context: null, nodes: {}, getStats: () => ({ mode }) };
    case 'browser-plus-webaudio':
      return createVoiceProcessedStream(rawStream, { ...options, enabled: true });
    case 'dtln-ai':
    case 'future-rnnoise':
    case 'future-krisp':
      try {
        return await createDtlnNoiseSuppressedStream(rawStream, options);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Voice] DTLN noise suppression unavailable, using Web Audio fallback:', error.message);
        }
        return createVoiceProcessedStream(rawStream, { ...options, enabled: true, fallbackFrom: mode });
      }
    default:
      return { stream: rawStream, cleanup: () => {}, context: null, nodes: {}, getStats: () => ({ mode: 'raw-fallback' }) };
  }
}
