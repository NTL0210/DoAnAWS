'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export default function useVoiceDevices() {
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');
  const [supportsOutputDevice, setSupportsOutputDevice] = useState(false);

  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      setError('This browser does not support audio device selection.');
      return [];
    }
    try {
      const nextDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(nextDevices);
      setSupportsOutputDevice(typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype);
      setError('');
      return nextDevices;
    } catch {
      setError('Could not read audio devices. Check browser permissions.');
      return [];
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    if (!navigator?.mediaDevices?.addEventListener) return undefined;
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  const audioInputs = useMemo(() => devices.filter((device) => device.kind === 'audioinput'), [devices]);
  const audioOutputs = useMemo(() => devices.filter((device) => device.kind === 'audiooutput'), [devices]);

  return {
    audioInputs,
    audioOutputs,
    devices,
    error,
    refreshDevices,
    supportsOutputDevice,
  };
}
