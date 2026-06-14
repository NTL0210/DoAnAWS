'use client';

import { useState } from 'react';
import { FiTerminal, FiX } from 'react-icons/fi';

const DEBUG = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_VOICE_DEBUG === 'true';

export default function VoiceDebugPanel({
  voiceConnection = {},
  voiceState = {},
  micStream = null,
  vadStream = null,
  processedMicStream = null,
  audioLevel = 0,
  rawRms = 0,
  vadPeak = 0,
  vadClippingRisk = false,
  audioProcessingStats = {},
  isSpeaking = false,
  vadSource = 'none',
  lastAudioLevelUpdateAt = null,
  recordingState = null,
  settings = {},
}) {
  const [open, setOpen] = useState(false);
  if (!DEBUG) return null;

  const {
    signalingStatus = '?',
    voicePeerStatus = '?',
    voiceConnectionState = '?',
    micStatus = '?',
    socketLatencyMs = null,
    hasRemotePeers = false,
    remoteStreams,
    peerStates,
    peerCount = 0,
    turnConfigured = false,
    stunConfigured = false,
    lastWebRTCError = '',
    lastSocketEvent = '',
    channelId = '',
    socketConnected = false,
  } = voiceConnection;

  const {
    muted = false,
    deafen = false,
    joined = false,
    pttActive = false,
  } = voiceState;

  const micTracks = micStream?.getAudioTracks?.() || [];
  const micTrack = micTracks[0] || null;
  const micTrackState = micTrack?.readyState || 'none';
  const micTrackEnabled = micTrack?.enabled ?? false;

  const vadTracks = vadStream?.getAudioTracks?.() || [];
  const vadTrack = vadTracks[0] || null;
  const vadTrackState = vadTrack?.readyState || 'none';
  const vadTrackEnabled = vadTrack?.enabled ?? false;

  const processedTracks = processedMicStream?.getAudioTracks?.() || [];
  const processedTrack = processedTracks[0] || null;
  const processedTrackState = processedTrack?.readyState || 'none';
  const micLabel = micTrack?.label || 'none';
  const micGetSettings = micTrack?.getSettings?.() || {};
  const threshold = settings.softVoiceMode ? 0.018 : (settings.inputSensitivity ?? 0.025);

  const remoteStreamEntries = remoteStreams instanceof Map
    ? Array.from(remoteStreams.entries())
    : Object.entries(remoteStreams || {});
  const peerEntries = peerStates instanceof Map
    ? Array.from(peerStates.entries())
    : Object.entries(peerStates || {});
  const remoteStreamCount = remoteStreamEntries.length;
  const audioElementCount = typeof document !== 'undefined' ? document.querySelectorAll('audio').length : 0;
  const duplicatePeerCount = peerEntries.length - new Set(peerEntries.map(([peerUserId]) => peerUserId)).size;

  const warnings = [];
  if (joined && micTrackState === 'ended') warnings.push('Track ended');
  if (joined && !micTrack) warnings.push('No microphone audio track found.');
  if (micTracks.length > 1) warnings.push('Duplicate local audio track detected.');
  if (joined && micTrackState !== 'ended' && !micTrackEnabled && !muted) warnings.push('Mic track disabled but muted state is false.');
  if (joined && micTrackState !== 'ended' && micTrackEnabled && muted) warnings.push('Mic track enabled but muted state is true.');
  if (joined && micTrackState !== 'ended' && micTrackEnabled && audioLevel === 0) {
    warnings.push('Mic is live but no input level detected. Try increasing Microphone Boost, enabling Soft Voice Mode, or selecting another input device.');
  }
  if (joined && isSpeaking && rawRms <= (settings.noiseFloor ?? 0.008) * 1.2) {
    warnings.push('Background noise is triggering voice activity. Increase threshold or run noise calibration.');
  }
  if (vadClippingRisk) warnings.push('VAD input peak is near clipping. Check microphone input level.');
  if (remoteStreamCount > 0 && remoteStreamCount !== audioElementCount) warnings.push(`Remote streams: ${remoteStreamCount}, audio elements: ${audioElementCount}`);
  if (!turnConfigured) warnings.push('TURN server is not configured.');
  if (!stunConfigured) warnings.push('STUN server is not configured.');
  if (peerEntries.some(([, peer]) => peer.poorNetwork)) warnings.push('Network quality is poor. Voice may lag or cut out.');
  if (duplicatePeerCount > 0) warnings.push('Duplicate peer detected.');
  if (lastWebRTCError) warnings.push(lastWebRTCError);
  if (deafen) warnings.push('Deafen active - remote audio muted.');
  if (signalingStatus === 'reconnecting') warnings.push('Socket heartbeat lost - reconnecting.');

  const rows = [
    ['Voice state', voiceConnectionState],
    ['Channel ID', channelId || '-'],
    ['Socket connected', String(socketConnected)],
    ['Last socket event', lastSocketEvent || '-'],
    ['Signaling', signalingStatus],
    ['Peer status', voicePeerStatus],
    ['Mic status', micStatus],
    ['Socket latency', socketLatencyMs != null ? `${socketLatencyMs}ms` : '-'],
    ['Joined', String(joined)],
    ['Muted', String(muted)],
    ['Deafen', String(deafen)],
    ['PTT active', String(pttActive)],
    ['Selected mic', settings.selectedMicId || settings.inputDeviceId || 'default'],
    ['Noise mode', settings.noiseSuppressionMode || 'future-krisp'],
    ['Browser noise suppression', String(Boolean(settings.noiseSuppression))],
    ['Echo cancellation', String(Boolean(settings.echoCancellation))],
    ['Auto gain control', String(Boolean(settings.autoGainControl))],
    ['Live mic gain', `${settings.micGain ?? settings.micBoost ?? 1.45}x`],
    ['Noise gate threshold', settings.noiseGateThreshold ?? 0.012],
    ['Noise gate reduction', settings.noiseGateReduction ?? 0.35],
    ['Processed raw level', audioProcessingStats.rawAudioLevel?.toFixed?.(4) || '-'],
    ['Processed level', audioProcessingStats.processedAudioLevel?.toFixed?.(4) || '-'],
    ['Gate gain', audioProcessingStats.gateGain?.toFixed?.(2) || '-'],
    ['Mic label', micLabel],
    ['Track enabled', String(micTrackEnabled)],
    ['Track muted', String(micTrack?.muted ?? false)],
    ['Track readyState', micTrackState],
    ['Track deviceId', micGetSettings.deviceId || '-'],
    ['Input volume', `${settings.inputVolume ?? 100}%`],
    ['Mic boost', `${settings.micBoost ?? 2}x`],
    ['Input sensitivity', settings.inputSensitivity ?? 0.025],
    ['Soft voice mode', String(Boolean(settings.softVoiceMode))],
    ['Noise floor', settings.noiseFloor ?? 0.008],
    ['Raw RMS', rawRms.toFixed(4)],
    ['VAD peak', vadPeak.toFixed(4)],
    ['VAD clipping risk', String(Boolean(vadClippingRisk))],
    ['Audio level', audioLevel > 0 ? `${(audioLevel * 100).toFixed(1)}%` : '0'],
    ['Threshold', Number(threshold).toFixed(4)],
    ['Speaking', String(isSpeaking)],
    ['VAD source', vadSource],
    ['Last level update', lastAudioLevelUpdateAt ? `${Math.round((Date.now() - lastAudioLevelUpdateAt) / 1000)}s ago` : '-'],
    ['VAD track state', vadTrackState],
    ['VAD track enabled', String(vadTrackEnabled)],
    ['Mic track state', micTrackState],
    ['Mic track enabled', String(micTrackEnabled)],
    ['Processed track state', processedTrackState],
    ['Remote streams', remoteStreamCount],
    ['Audio elements', audioElementCount],
    ['Has remote peers', String(hasRemotePeers)],
    ['Peers count', peerCount],
    ['TURN configured', String(turnConfigured)],
    ['STUN configured', String(stunConfigured)],
    ['Force TURN', process.env.NEXT_PUBLIC_FORCE_TURN === 'true' ? 'ON' : 'OFF'],
    ['Local audio tracks', micTracks.length],
  ];

  if (recordingState) rows.push(['Recording', typeof recordingState === 'object' ? recordingState.recordingMode || 'recording' : recordingState]);
  const recordingRows = recordingState && typeof recordingState === 'object' ? [
    ['isRecording', true],
    ['recordingMode', recordingState.recordingMode || '-'],
    ['recordingSource', recordingState.recordingSource || '-'],
    ['actualMimeType', recordingState.mimeType || '-'],
    ['actualAudioBitsPerSecond', recordingState.actualAudioBitsPerSecond || '-'],
    ['timeslice', recordingState.timeslice || '-'],
    ['audioContextSampleRate', recordingState.audioContextSampleRate || '-'],
    ['trackSampleRate', recordingState.trackSampleRate || '-'],
    ['rawRms', recordingState.metrics?.rawRms?.toFixed?.(4) || '0'],
    ['rawPeak', recordingState.metrics?.rawPeak?.toFixed?.(4) || '0'],
    ['recordingRms', recordingState.metrics?.recordingRms?.toFixed?.(4) || '0'],
    ['recordingPeak', recordingState.metrics?.recordingPeak?.toFixed?.(4) || '0'],
    ['clippingRisk', String(Boolean(recordingState.metrics?.clippingRisk))],
    ['compressorReduction', recordingState.metrics?.compressorReduction?.toFixed?.(2) || '0'],
    ['chunks count', recordingState.metrics?.chunkCount || 0],
    ['latest chunk size', recordingState.metrics?.latestChunkSize || 0],
    ['usingVadBoostForRecording', String(Boolean(recordingState.usingVadBoostForRecording))],
  ] : [];
  if (recordingState?.usingVadBoostForRecording) {
    warnings.push('Recording is using VAD boost. Separate recording pipeline required.');
  }
  if (recordingState?.metrics?.clippingRisk) {
    warnings.push('Recording is clipping. Reduce gain, disable boost, or lower input volume.');
  }
  if ((recordingState?.metrics?.compressorReduction || 0) > 8) {
    warnings.push('Compressor is working too hard. Recording may sound unnatural.');
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-700"
        title="Voice debug panel"
      >
        {open ? <FiX className="h-4 w-4" /> : <FiTerminal className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="absolute bottom-12 right-0 w-96 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Voice Debug</h3>

          {warnings.length > 0 ? (
            <div className="mt-3 space-y-1">
              {warnings.map((warning) => (
                <div key={warning} className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <table className="mt-3 w-full text-[10px] font-semibold">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="py-1 text-slate-400">{label}</td>
                  <td className="max-w-[220px] truncate py-1 text-right font-black">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {peerEntries.length > 0 ? (
            <div className="mt-3">
              <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-400">Peers</h4>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                {peerEntries.map(([peerUserId, peer]) => (
                  <div key={peerUserId} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">
                    <div className="truncate font-black text-slate-700">{peerUserId}</div>
                    <div>connection: {peer.connectionState || '-'} | ice: {peer.iceState || '-'} | signaling: {peer.signalingState || '-'}</div>
                    {/* ── ICE candidate type ────────────────────────── */}
                    <div className={`mt-0.5 font-bold ${
                      peer.isRelay ? 'text-emerald-600' : peer.candidateType === 'srflx' ? 'text-blue-600' : peer.candidateType === 'host' ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                      candidate: {peer.candidateLabel || peer.candidateType || 'pending'}
                      {peer.candidateProtocol ? ` (${peer.candidateProtocol})` : ''}
                      &nbsp;|&nbsp;
                      <span className="font-mono">
                        {peer.candidateInfo?.localCandidate
                          ? `${peer.candidateInfo.localCandidate.ip}:${peer.candidateInfo.localCandidate.port}`
                          : ''}
                      </span>
                    </div>
                    {peer.candidateInfo?.remoteCandidate ? (
                      <div className="text-slate-400">
                        remote: {peer.candidateInfo.remoteCandidate.ip}:{peer.candidateInfo.remoteCandidate.port}
                        &nbsp;({peer.candidateInfo.remoteCandidate.type})
                      </div>
                    ) : null}
                    {/* ── RTT / stats ──────────────────────────────── */}
                    {peer.candidateInfo?.currentRoundTripTime != null ? (
                      <div className={peer.candidateInfo.currentRoundTripTime > 0.3 ? 'text-rose-500' : 'text-slate-500'}>
                        rtt: {Math.round(peer.candidateInfo.currentRoundTripTime * 1000)}ms
                        {peer.candidateInfo.availableOutgoingBitrate ? ` | bitrate: ${(peer.candidateInfo.availableOutgoingBitrate / 1000).toFixed(0)}kbps` : ''}
                        &nbsp;| rx: {peer.candidateInfo.bytesReceived ?? 0}B | tx: {peer.candidateInfo.bytesSent ?? 0}B
                      </div>
                    ) : (
                      <div>
                        rtt: {peer.stats?.roundTripTime != null ? `${Math.round(peer.stats.roundTripTime * 1000)}ms` : '-'}
                        &nbsp;| jitter: {peer.stats?.jitter != null ? `${Math.round(peer.stats.jitter * 1000)}ms` : '-'}
                        &nbsp;| lost: {peer.stats?.packetsLost ?? 0}
                      </div>
                    )}
                    {peer.candidateInfo ? null : (
                      <div>sent/recv: {peer.stats?.packetsSent ?? 0}/{peer.stats?.packetsReceived ?? 0} ({peer.stats?.bytesSent ?? 0}B/{peer.stats?.bytesReceived ?? 0}B)</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {recordingRows.length > 0 ? (
            <div className="mt-3">
              <h4 className="text-[10px] font-black uppercase tracking-wide text-slate-400">Recording</h4>
              <table className="mt-1 w-full text-[10px] font-semibold">
                <tbody>
                  {recordingRows.map(([label, value]) => (
                    <tr key={label} className="border-b border-slate-100">
                      <td className="py-1 text-slate-400">{label}</td>
                      <td className="max-w-[220px] truncate py-1 text-right font-black">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
