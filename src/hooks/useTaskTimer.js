import { useCallback, useEffect, useState } from 'react';
import { getTaskTime, startTaskTimer, stopTaskTimer, TIMER_CHANGED_EVENT } from '../api/timeLog';

export function useTaskTimer(taskId) {
  const [snapshot, setSnapshot] = useState(null); // { data, fetchedAt }
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const summary = snapshot?.data ?? null;

  // Used by event handlers (after start/stop, tab becomes visible)
  const refresh = useCallback(async () => {
    try {
      const data = await getTaskTime(taskId);
      const ts = Date.now();
      setSnapshot({ data, fetchedAt: ts });
      setNow(ts);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to load time data');
    }
  }, [taskId]);

  // Initial load: setState only happens inside the promise callbacks
  useEffect(() => {
    let cancelled = false;

    getTaskTime(taskId)
      .then((data) => {
        if (cancelled) return;
        const ts = Date.now();
        setSnapshot({ data, fetchedAt: ts });
        setNow(ts);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.message ?? 'Failed to load time data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true; // ignore results if the component unmounts or taskId changes
    };
  }, [taskId]);

  // Tick every second, only while a timer is running
  const isRunning = !!summary?.running;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Resync when the tab becomes visible again (laptop sleep, background tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // Resync when a timer starts, stops, or task is submitted elsewhere
  useEffect(() => {
    window.addEventListener(TIMER_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TIMER_CHANGED_EVENT, refresh);
  }, [refresh]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      window.dispatchEvent(new Event(TIMER_CHANGED_EVENT));
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const start = () => act(() => startTaskTimer(taskId));
  const stop = (note) => act(() => stopTaskTimer(taskId, note));

  const sinceFetch =
    isRunning && snapshot ? Math.max(0, (now - snapshot.fetchedAt) / 1000) : 0;
  const totalSeconds = (summary?.totalSeconds ?? 0) + sinceFetch;
  const sessionSeconds = isRunning
    ? summary.totalSeconds - summary.closedSeconds + sinceFetch
    : 0;

  return {
    summary, loading, busy, error, isRunning,
    totalSeconds, sessionSeconds, start, stop, refresh,
  };
}