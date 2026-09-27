"use client";

import { useEffect, useRef } from "react";

/**
 * A live input-level bar. It writes to the DOM directly from an animation
 * frame so the meter doesn't re-render React sixty times a second.
 */
export function MicLevel({ stream, className = "" }: { stream: MediaStream | null; className?: string }) {
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!stream) return;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      if (barRef.current) barRef.current.style.width = `${Math.min(100, (peak / 64) * 100)}%`;
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void ctx.close();
    };
  }, [stream]);

  return (
    <span
      aria-hidden
      className={`block h-2 overflow-hidden rounded bg-[var(--bg-panel)] ${className}`}
    >
      <span
        ref={barRef}
        className="block h-full w-0 rounded transition-[width] duration-75"
        style={{ background: "var(--correct)" }}
      />
    </span>
  );
}
