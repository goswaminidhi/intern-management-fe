import { useCallback, useEffect, useState } from 'react';
import { getActiveTimer, TIMER_CHANGED_EVENT } from '../api/timeLog';

export function useActiveTimer(enabled = true) {
  const [active, setActive] = useState(null); // { log, fetchedAt }
  const [now, setNow] = useState(0);

  const apply = (log) => {
    const ts = Date.now();
    setActive(log ? { log, fetchedAt: ts } : null);
    setNow(ts);
  };

  // Used by event handlers (timer changed elsewhere, tab visible again)
  const load = useCallback(async () => {
    try {
      const log = await getActiveTimer();
      const ts = Date.now();
      setActive(log ? { log, fetchedAt: ts } : null);
      setNow(ts);
    } catch {
      /* the badge is non-critical, so ignore failures */
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getActiveTimer()
      .then((log) => { if (!cancelled) apply(log); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  // Stay in sync: timer started/stopped on the task page, or tab regains focus
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener(TIMER_CHANGED_EVENT, load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(TIMER_CHANGED_EVENT, load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, load]);

  // Tick every second, only while a timer is running
  const isRunning = !!active;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsedSeconds = active
    ? active.log.elapsed_seconds + Math.max(0, (now - active.fetchedAt) / 1000)
    : 0;

  return { active: enabled ? active : null, elapsedSeconds };
}