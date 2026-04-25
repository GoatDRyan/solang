import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

export default function ExamTimer({
  durationSeconds,
  isRunning = true,
  isPaused = false,
  onComplete,
  onTick,
  label = 'Time remaining',
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const hasCompletedRef = useRef(false);

  const progress = useMemo(() => {
    if (!durationSeconds) return 0;

    return Math.max(
      0,
      Math.min(100, (remainingSeconds / durationSeconds) * 100)
    );
  }, [durationSeconds, remainingSeconds]);

  useEffect(() => {
    setRemainingSeconds(durationSeconds);
    hasCompletedRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    if (!isRunning || isPaused || remainingSeconds <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        const next = Math.max(0, previous - 1);

        if (onTick) {
          onTick(next);
        }

        if (next === 0 && !hasCompletedRef.current) {
          hasCompletedRef.current = true;

          if (onComplete) {
            onComplete();
          }
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, isPaused, remainingSeconds, onComplete, onTick]);

  return (
    <div className="rounded-[1.25rem] bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {label}
          </p>

          <p className="mt-1 text-2xl font-bold tabular-nums text-text">
            {formatTime(remainingSeconds)}
          </p>
        </div>

        <div
          className={[
            'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold',
            isPaused
              ? 'bg-warning-soft text-warning-text'
              : 'bg-success-soft text-success-text',
          ].join(' ')}
        >
          {isPaused ? <Pause size={14} /> : <Play size={14} />}
          {isPaused ? 'Paused' : 'Running'}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {isPaused && (
        <p className="mt-3 text-xs text-text-muted">
          Timer paused while Solang is generating or loading exam audio.
        </p>
      )}
    </div>
  );
}