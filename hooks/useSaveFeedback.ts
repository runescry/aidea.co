'use client';

import { useState, useCallback, useRef } from 'react';

export function useSaveFeedback() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearSaved = useCallback(() => {
    setSaved(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const runSave = useCallback(async (fn: () => Promise<void>) => {
    setSaving(true);
    clearSaved();
    try {
      await fn();
      setSaved(true);
      timeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [clearSaved]);

  return { saving, saved, clearSaved, runSave };
}
