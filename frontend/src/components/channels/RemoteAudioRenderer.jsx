'use client';

import { useEffect, useRef, useState } from 'react';
import { VOICE_AUDIO_CONFIG } from '@/config/voiceAudioConfig';

const DEBUG = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';
const MAX_REMOTE_VOLUME = VOICE_AUDIO_CONFIG.maxRemotePlaybackGain ?? 2;

function clampRemoteVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0, Math.min(MAX_REMOTE_VOLUME, numeric));
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function createRemotePlaybackGraph(stream) {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return null;

  const context = new AudioContextConstructor();
  const sourceNode = context.createMediaStreamSource(stream);
  const gainNode = context.createGain();
  const destinationNode = context.createMediaStreamDestination();

  sourceNode.connect(gainNode);
  gainNode.connect(destinationNode);

  return {
    context,
    gainNode,
    stream: destinationNode.stream,
    cleanup() {
      sourceNode.disconnect();
      gainNode.disconnect();
      context.close?.().catch(() => {});
    },
  };
}

function RemoteAudio({ userId, stream, deafen = false, outputDeviceId = '', volume = 1, onBlocked }) {
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const graphRef = useRef(null);

  const cleanupPlaybackGraph = () => {
    graphRef.current?.cleanup();
    graphRef.current = null;
  };

  // Effect 1: Stream setup — only runs when the actual stream reference changes.
  // Removing srcObject or pausing on deafen toggle destroys playback permanently.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;

    // Only re-assign srcObject if the stream identity changed
    if (streamRef.current !== stream) {
      streamRef.current = stream;
      cleanupPlaybackGraph();
      audio.__voiceAudioContext = null;
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

    const resumePromise = audio.__voiceAudioContext?.state === 'suspended'
      ? audio.__voiceAudioContext.resume?.()
      : null;
    const playPromise = Promise.resolve(resumePromise).then(() => audio.play());
    if (playPromise?.catch) {
      playPromise.catch((error) => {
        if (DEBUG) console.warn('[Voice/Audio] play blocked', userId, error.message);
        onBlocked?.(userId);
      });
    }

    return () => {
      // Only clean up srcObject when the stream is being replaced or unmounting
      // NOT when deafen/volume/outputDevice change
      if (streamRef.current === stream) {
        streamRef.current = null;
        cleanupPlaybackGraph();
        audio.__voiceAudioContext = null;
        audio.pause();
        audio.srcObject = null;
      }
    };
    // Intentionally only depend on stream identity — this effect owns srcObject lifecycle.
    // Deafening/volume/outputDeviceId are managed by separate effects (2 and 3) that
    // do NOT touch srcObject, preventing playback destruction.
    // `onBlocked` is intentionally excluded because this effect fires on stream re-assignment,
    // not on callback churn — stale onBlocked is a no-op (play-block is per-user, not per-stream).
    // `DEBUG` is a module-level const (stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, userId]);

  // Effect 2: Playback state (mute/volume/deafen) — does NOT touch srcObject
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextVolume = clampRemoteVolume(volume);
    const wasDeafened = audio.muted;
    audio.muted = Boolean(deafen);
    if (nextVolume > 1 && streamRef.current) {
      if (!graphRef.current) {
        graphRef.current = createRemotePlaybackGraph(streamRef.current);
        audio.__voiceAudioContext = graphRef.current?.context || null;
        audio.srcObject = graphRef.current?.stream || streamRef.current;
      }
      if (graphRef.current?.gainNode) {
        graphRef.current.gainNode.gain.setTargetAtTime(
          nextVolume,
          graphRef.current.context.currentTime,
          0.01
        );
      }
      audio.volume = 1;
    } else {
      if (graphRef.current && streamRef.current) {
        cleanupPlaybackGraph();
        audio.__voiceAudioContext = null;
        audio.srcObject = streamRef.current;
      }
      audio.volume = Math.min(1, nextVolume);
    }

    // When undeafening (deafen goes from true → false), browser may have
    // paused the audio element. Explicitly resume playback.
    if (!deafen && wasDeafened && audio.paused) {
      Promise.resolve(audio.__voiceAudioContext?.resume?.())
        .then(() => audio.play())
        .catch(() => {
        // Autoplay blocked — handled by the "Enable audio" button in RemoteAudioRenderer
        });
    }
  }, [deafen, volume]);

  // Effect 3: Output device
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
      Promise.resolve(audio.__voiceAudioContext?.resume?.())
        .then(() => audio.play?.())
        .catch(() => setBlocked(true));
    });
  };

  // Debug: warn on duplicate audio elements per user
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
