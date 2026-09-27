"use client";

import { useEffect, useState } from "react";

/**
 * Counts down to a wall-clock deadline rather than decrementing a counter, so
 * the timer stays accurate when the tab is throttled or the machine sleeps.
 * Fires `onExpire` exactly once.
 */
export function useCountdown(endsAt: number | null, onExpire?: () => void): number {
  const [remaining, setRemaining] = useState(() =>
    endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (endsAt === null) return;

    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    // A tab restored from the background can be many seconds stale.
    const onVisible = () => tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `onExpire` is intentionally not a dependency: re-running would restart
    // the interval on every parent render and could fire the callback twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  return remaining;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(h > 0 ? m : m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Long form for announcements and the results page. */
export function formatDuration(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 1) return "under a minute";
  if (m === 1) return "1 minute";
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} hour${h > 1 ? "s" : ""}` : `${h}h ${rest}m`;
}
