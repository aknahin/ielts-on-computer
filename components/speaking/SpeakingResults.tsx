"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSpeakingStore, type Clip } from "@/lib/speakingStore";
import { formatClock } from "@/lib/useTimer";

const CRITERIA = [
  {
    name: "Fluency and Coherence",
    ask: "Did you keep going without long pauses, and link your ideas clearly?",
  },
  {
    name: "Lexical Resource",
    ask: "Did you use a range of vocabulary, and rephrase when you couldn't find a word?",
  },
  {
    name: "Grammatical Range and Accuracy",
    ask: "Did you mix simple and complex sentences, with few errors?",
  },
  {
    name: "Pronunciation",
    ask: "Were you easy to understand, with natural stress and intonation?",
  },
];

const PART_TITLE: Record<Clip["part"], string> = {
  1: "Part 1 — Introduction and interview",
  2: "Part 2 — Long turn",
  3: "Part 3 — Discussion",
};

export function SpeakingResults() {
  const router = useRouter();
  const session = useSpeakingStore((s) => s.session);
  const reset = useSpeakingStore((s) => s.reset);

  useEffect(() => {
    if (!session || session.finishedAt === null) router.replace("/");
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [session, router]);

  if (!session || session.finishedAt === null) return null;
  const { test, clips } = session;
  const total = clips.reduce((ms, c) => ms + c.ms, 0) / 1000;
  const longTurn = clips.find((c) => c.stepId === "p2-talk");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your Speaking answers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {test.title} · {clips.length} recording{clips.length === 1 ? "" : "s"} ·{" "}
            <span className="tabular-nums">{formatClock(Math.round(total))}</span> of speaking
          </p>
        </div>
        <Link
          href="/"
          onClick={reset}
          className="no-print rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
        >
          Back to home
        </Link>
      </header>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Speaking is marked by an examiner, so there is no automatic band score. Listen back with
        the checklist below in mind. Recordings are kept only until you leave this page — download
        any you want to keep.
      </p>

      {longTurn && (
        <p className="mt-4 rounded border border-[var(--border)] px-4 py-2.5 text-sm">
          Your Part 2 long turn lasted{" "}
          <span className="font-semibold tabular-nums">{formatClock(Math.round(longTurn.ms / 1000))}</span>
          .{" "}
          {longTurn.ms < 60_000
            ? "Aim for the full two minutes — stopping early usually costs fluency marks."
            : "Good — that is within the expected one to two minutes."}
        </p>
      )}

      {([1, 2, 3] as const).map((part) => {
        const list = clips.filter((c) => c.part === part);
        return (
          <section key={part} className="mt-8">
            <h2 className="text-lg font-bold">{PART_TITLE[part]}</h2>
            {part === 2 && session.notes.trim() && (
              <div className="mt-3 rounded border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-sm">
                <p className="font-semibold">Your notes</p>
                <p className="mt-1 whitespace-pre-wrap">{session.notes}</p>
              </div>
            )}
            {list.length === 0 ? (
              <p className="mt-2 text-sm italic text-[var(--muted)]">Nothing was recorded for this part.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {list.map((clip, i) => (
                  <li key={clip.stepId} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="font-medium">{clip.prompt}</p>
                      <span className="text-sm tabular-nums text-[var(--muted)]">
                        {formatClock(Math.round(clip.ms / 1000))}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <audio controls preload="metadata" src={clip.url} className="w-full" />
                      <a
                        href={clip.url}
                        download={`speaking-part${clip.part}-${i + 1}.${clip.ext}`}
                        className="no-print shrink-0 rounded border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium"
                      >
                        Download
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="mt-8 rounded-lg border border-[var(--border)] px-5 py-4">
        <h2 className="font-semibold">Self-check</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {CRITERIA.map((c) => (
            <li key={c.name}>
              <span className="font-medium">{c.name}:</span>{" "}
              <span className="text-[var(--muted)]">{c.ask}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
