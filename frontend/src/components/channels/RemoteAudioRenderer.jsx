'use client';

import { useEffect, useRef, useState } from 'react';
import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';

const DEBUG = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

function clampPlaybackVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0, Math.min(1, numeric));
}

function RemoteAudio({ userId, stream, deafen = false, outputDeviceId = '', volume = 1, onBlocked }) {
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  // Stream setup only runs when the actual remote stream reference changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;

    if (streamRef.current !== stream) {
      streamRef.current = stream;
      audio.srcObject = stream;
      if (DEBUG) {
        console.info('[Voice/Audio] attached remote stream', {
          userId,
          streamId: stream.id,
          audioTracks: stream.getAudioTracks().length,
          readyState: stream.getAudioTracks()[0]?.readyState,
        });
      }
    }

    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch((error) => {
        if (DEBUG) console.warn('[Voice/Audio] play blocked', userId, error.message);
        onBlocked?.(userId);
      });
    }

    return () => {
      if (streamRef.current === stream) {
        streamRef.current = null;
        audio.pause();
        audio.srcObject = null;
      }
    };
    // Intentionally only depend on stream identity. Deafen, volume, and output
    // device changes are handled by separate effects that do not touch srcObject.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, userId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const wasDeafened = audio.muted;
    audio.muted = Boolean(deafen);
    audio.volume = clampPlaybackVolume(volume);

    if (!deafen && wasDeafened && audio.paused) {
      audio.play().catch(() => {
        // Autoplay is handled by the Enable audio button.
      });
    }
  }, [deafen, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !outputDeviceId || typeof audio.setSinkId !== 'function') return;
    audio.setSinkId(outputDeviceId).catch((error) => {
      if (DEBUG) console.warn('[Voice/Audio] setSinkId failed', userId, error.message);
    });
  }, [outputDeviceId, userId]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

export default function RemoteAudioRenderer({ remoteStreams, settings = {} }) {
  const [blocked, setBlocked] = useState(false);
  const streams = remoteStreams instanceof Map ? Array.from(remoteStreams.entries()) : Object.entries(remoteStreams || {});
  const outputVolume = settings.outputVolume ?? VOICE_AUDIO_CONFIG.remoteDefaultVolume;
  const perUserVolumes = settings.perUserVolumes || {};

  const handleBlocked = () => setBlocked(true);
  const unlockAudio = () => {
    setBlocked(false);
    document.querySelectorAll('audio').forEach((audio) => {
      audio.play?.().catch(() => setBlocked(true));
    });
  };

  if (DEBUG) {
    const userIds = streams.map(([uid]) => uid);
    const seen = new Set();
    userIds.forEach((uid) => {
      if (seen.has(uid)) {
        console.warn('[Voice/Audio] DUPLICATE audio element for user:', uid);
      }
      seen.add(uid);
    });
  }

  return (
    <>
      <div className="hidden">
        {streams.map(([userId, stream]) => (
          <RemoteAudio
            key={userId}
            userId={userId}
            stream={stream}
            deafen={settings.deafen}
            outputDeviceId={settings.outputDeviceId}
            volume={outputVolume * (perUserVolumes[userId] ?? 1)}
            onBlocked={handleBlocked}
          />
        ))}
      </div>
      {blocked ? (
        <button
          type="button"
          onClick={unlockAudio}
          className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-100"
        >
          Click to enable voice audio
        </button>
      ) : null}
    </>
  );
}
