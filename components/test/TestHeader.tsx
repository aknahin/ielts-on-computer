"use client";

import { formatClock } from "@/lib/useTimer";
import { useFullscreen } from "@/lib/useFullscreen";
import { OptionsMenu } from "./OptionsMenu";

/** Seconds remaining at which the header changes colour (video 4:26). */
export const WARNING_AT = 60;

/**
 * The top band shared by every section: title, clock and the options menu.
 * The whole band changes colour in the last minute.
 */
export function TestHeader({
  title,
  remaining,
  clockLabel = "Time remaining",
  warnAt = WARNING_AT,
  children,
  onShowInstructions,
  onSubmit,
}: {
  title: string;
  /** Seconds left on the clock, or null to hide it. */
  remaining: number | null;
  clockLabel?: string;
  /** Seconds left at which the band changes colour. */
  warnAt?: number;
  /** Extra controls placed before the options menu. */
  children?: React.ReactNode;
  onShowInstructions: () => void;
  onSubmit: () => void;
}) {
  const warning = remaining !== null && remaining <= warnAt;

  return (
    <header
      className="flex shrink-0 items-center gap-4 border-b border-[var(--border-strong)] px-4 py-2.5 transition-colors"
      style={{
        background: warning ? "var(--warn-bg)" : "var(--bg-panel)",
        color: warning ? "var(--warn-fg)" : "inherit",
      }}
    >
      <h1 className="min-w-0 truncate text-sm font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {remaining !== null && (
          <div
            role="timer"
            aria-live={warning ? "assertive" : "off"}
            className="tabular-nums"
            title={clockLabel}
          >
            <span className="text-xs uppercase tracking-wide">
              {warning && warnAt === WARNING_AT ? "1 minute left" : clockLabel}
            </span>{" "}
            <span className="text-lg font-bold">{formatClock(remaining)}</span>
          </div>
        )}

        {children}

        <OptionsMenu onShowInstructions={onShowInstructions} onSubmit={onSubmit} />
      </div>
    </header>
  );
}

/** Shown when the candidate leaves fullscreen mid-test. */
export function FullscreenBanner({ note = "The timer is still running." }: { note?: string }) {
  const { isFullscreen, supported, enter } = useFullscreen();
  if (!supported || isFullscreen) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--warn-bg)] px-4 py-2 text-sm text-[var(--warn-fg)]">
      <span>You have left fullscreen. {note}</span>
      <button
        type="button"
        onClick={() => void enter()}
        className="rounded border border-current px-3 py-1 font-semibold"
      >
        Return to fullscreen
      </button>
    </div>
  );
}
