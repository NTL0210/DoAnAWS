'use client';

import { useCallback, useEffect, useRef } from 'react';

export default function useThrottledCallback(callback, delayMs = 100) {
  const callbackRef = useRef(callback);
  const lastRunRef = useRef(0);
  const timeoutRef = useRef(null);
  const pendingArgsRef = useRef(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return useCallback((...args) => {
    const now = Date.now();
    const elapsed = now - lastRunRef.current;
    pendingArgsRef.current = args;

    const run = () => {
      lastRunRef.current = Date.now();
      timeoutRef.current = null;
      const latestArgs = pendingArgsRef.current || [];
      pendingArgsRef.current = null;
      callbackRef.current(...latestArgs);
    };

    if (elapsed >= delayMs) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      run();
      return;
    }

    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(run, delayMs - elapsed);
    }
  }, [delayMs]);
}
