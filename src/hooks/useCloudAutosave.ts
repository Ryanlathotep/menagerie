import { useEffect, useRef } from 'react';
import { useCloudSave } from './useCloudSave';
import { SaveData } from '@/game/types';

interface Options {
  /** Minimum delay between writes after a change (debounce). Default: 5s */
  debounceMs?: number;
  /** Hard cap: at least one save every this often if changes pending. Default: 30s */
  intervalMs?: number;
}

/**
 * Periodic + debounced cloud autosave.
 * - Saves silently (no toasts) when signed in.
 * - Debounces rapid saveData changes by `debounceMs`.
 * - Guarantees a flush at most every `intervalMs` while changes are pending.
 * - Flushes once on tab hide/unload so a refresh doesn't drop progress.
 */
export function useCloudAutosave(saveData: SaveData, opts: Options = {}) {
  const { debounceMs = 5000, intervalMs = 30000 } = opts;
  const { saveToCloud, isAuthenticated } = useCloudSave();

  // Keep latest saveData in a ref so timers always read the freshest snapshot.
  const latestRef = useRef(saveData);
  latestRef.current = saveData;

  const lastSavedJsonRef = useRef<string>('');
  const lastSaveAtRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const flush = async (reason: 'debounce' | 'interval' | 'visibility' | 'milestone') => {
      if (inFlightRef.current) return;
      const json = JSON.stringify(latestRef.current);
      if (json === lastSavedJsonRef.current) return;

      inFlightRef.current = true;
      try {
        const result = await saveToCloud(latestRef.current);
        if (result.success) {
          lastSavedJsonRef.current = json;
          lastSaveAtRef.current = Date.now();
          // eslint-disable-next-line no-console
          console.debug('[autosave] saved to cloud', { reason });
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => flush('debounce'), debounceMs);

    const intervalId = setInterval(() => flush('interval'), intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush('visibility');
    };
    const onMilestone = () => {
      // Immediate flush on level-up / equipment change. Cancel pending debounce.
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      flush('milestone');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', () => flush('visibility'));
    window.addEventListener('cloud-save-request', onMilestone);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('cloud-save-request', onMilestone);
    };
  }, [saveData, isAuthenticated, saveToCloud, debounceMs, intervalMs]);
}
