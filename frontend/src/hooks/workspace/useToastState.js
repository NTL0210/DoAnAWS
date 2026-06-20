'use client';

import { useState, useCallback } from 'react';
import { generateId } from '@/lib/workspaceData';

/**
 * useToastState — manages toast notifications.
 *
 * @returns {{
 *   toasts: Array<{id: string, type: string, message: string}>,
 *   showToast: (type: string, message: string) => string,
 *   dismissToast: (toastId: string) => void,
 * }}
 */
export default function useToastState() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, message) => {
    const id = 'toast-' + generateId();
    setToasts((prev) => [...prev, { id, type, message }]);
    // Auto-dismiss after 3.5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
    return id;
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
  };
}
