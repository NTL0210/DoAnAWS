/**
 * useDebounce — debounce a value or callback by a configurable delay
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchTerm, 300);
 *   // use debouncedSearch in API calls / filters
 *
 *   const save = useDebounce(() => saveData(), 1000);
 *   // save() will debounce rapid calls
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { DEBOUNCE_MS } from '@/domain/constants/costConstants';

/**
 * Debounce a value — the returned value only updates after `delay` ms of inactivity
 *
 * @template T
 * @param {T} value — the value to debounce
 * @param {number} [delay=DEBOUNCE_MS]
 * @returns {T}
 */
export function useDebounce(value, delay = DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback — the returned function only fires after `delay` ms of inactivity
 *
 * @param {Function} callback
 * @param {number} [delay=DEBOUNCE_MS]
 * @returns {Function}
 */
export function useDebouncedCallback(callback, delay = DEBOUNCE_MS) {
  const timerRef = useRef(null);

  const debouncedFn = useCallback(
    (...args) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        callback(...args);
        timerRef.current = null;
      }, delay);
    },
    [callback, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

export default useDebounce;
