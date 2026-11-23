// src/components/TaskTimer.jsx
import { useState } from 'react';
import { useTaskTimer } from '../hooks/useTaskTimer';
import { formatDuration, formatHours } from '../utils/formatDuration';

export default function TaskTimer({ taskId, estimatedHours, taskStatus, canTrack }) {
  const t = useTaskTimer(taskId);
  const [note, setNote] = useState('');

  if (t.loading) {
    return <p className="text-xs text-slate-400 italic">Loading time data…</p>;
  }

  const estimatedSeconds = (Number(estimatedHours) || 0) * 3600;
  const pct = estimatedSeconds > 0 ? Math.min(100, (t.totalSeconds / estimatedSeconds) * 100) : 0;
  const over = estimatedSeconds > 0 && t.totalSeconds > estimatedSeconds;
  const locked = ['submitted', 'complete', 'blocker', 'hold'].includes(taskStatus);

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-4 space-y-4 text-slate-800 dark:text-slate-100 shadow-xs">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <span>⏱️ Time Tracking</span>
          {taskStatus === 'blocker' && (
            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
              Blocked · Timer Paused
            </span>
          )}
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{formatHours(t.totalSeconds)}h</span>
          {Number(estimatedHours) > 0 ? ` of ${estimatedHours}h estimated` : ' logged'}
        </span>
      </header>

      {/* Estimated vs actual progress bar */}
      {Number(estimatedHours) > 0 && (
        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${over ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Live clock */}
      {t.isRunning && !locked && (
        <div className="text-center py-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
          <div className="font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
            {formatDuration(t.sessionSeconds)}
          </div>
          <div className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            Current active session
          </div>
        </div>
      )}

      {/* Controls: assigned mentee only */}
      {canTrack && !locked && (
        <div className="space-y-2">
          {t.isRunning ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you work on? (optional note)"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              <button
                type="button"
                disabled={t.busy}
                onClick={async () => {
                  await t.stop(note || undefined);
                  setNote('');
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Pause / Stop
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={t.busy}
              onClick={() => t.start()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>▶</span>
              <span>{(t.summary?.logs.length ?? 0) > 0 ? 'Resume Timer' : 'Start Timer'}</span>
            </button>
          )}
        </div>
      )}

      {t.error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{t.error}</p>
      )}

      {/* Session history */}
      {t.summary && t.summary.logs.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Time Sessions ({t.summary.logs.length})
          </p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
            {t.summary.logs.map((l) => {
              const isAutoClosed = Boolean(l.auto_closed ?? l.autoClosed);
              return (
                <li key={l.id} className="flex items-center justify-between py-2 gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {new Date(l.started_at).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isAutoClosed && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        auto-closed
                      </span>
                    )}
                    {l.note && (
                      <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-[200px]">
                        · {l.note}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 flex-shrink-0">
                    {l.ended_at ? formatDuration(l.duration_seconds ?? 0) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                        running
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}