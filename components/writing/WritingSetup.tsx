"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IssueList } from "@/components/setup/IssueList";
import { parseJson, parseWritingTest, type ValidationIssue, type WritingTest } from "@/lib/schema";
import { formatDuration } from "@/lib/useTimer";
import { useWritingStore } from "@/lib/writingStore";

function read(text: string): { test: WritingTest | null; issues: ValidationIssue[] } {
  const json = parseJson(text);
  if (!json.ok) return { test: null, issues: json.issues };
  const parsed = parseWritingTest(json.value);
  return parsed.ok ? { test: parsed.value, issues: [] } : { test: null, issues: parsed.issues };
}

export function WritingSetup({
  testTitle,
  file,
}: {
  testTitle: string;
  file: { text: string; filename: string };
}) {
  const router = useRouter();
  const start = useWritingStore((s) => s.start);
  const [starting, setStarting] = useState(false);
  const { test, issues } = useMemo(() => read(file.text), [file.text]);

  function onStart() {
    if (!test) return;
    setStarting(true);
    // Fullscreen needs this click as its gesture; the test page requests it
    // on mount while the gesture is still live.
    start(test);
    router.push("/writing");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-[var(--muted)] underline">
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{testTitle} — Writing</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Loaded from the test library. Check the details below, then start when you are ready.
      </p>

      <IssueList title={file.filename} issues={issues} />

      {test && (
        <section className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-lg font-semibold">{test.title}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <Stat label="Tasks" value={String(test.tasks.length)} />
            <Stat label="Time" value={formatDuration(test.durationSeconds)} />
            <Stat label="Marking" value="Self-assessed" />
          </dl>
          <ul className="mt-5 space-y-2 text-sm">
            {test.tasks.map((t) => (
              <li key={t.task} className="flex gap-3">
                <span className="w-16 shrink-0 font-semibold">Part {t.task}</span>
                <span>
                  About {t.minutes} minutes · at least {t.minWords} words
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-[var(--border)] p-4 text-sm leading-relaxed">
        <h2 className="font-semibold">How this works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>One clock covers both parts. Move between them at any time.</li>
          <li>The word count updates as you type. Spell check is switched off, as in the exam.</li>
          <li>When time runs out your answers are submitted automatically.</li>
          <li>Afterwards you can review, print or download what you wrote.</li>
        </ul>
      </section>

      <button
        type="button"
        disabled={!test || starting}
        onClick={onStart}
        className="mt-6 w-full rounded-lg bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-[var(--accent-fg)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {starting ? "Starting…" : "Start test"}
      </button>
      <p className="mt-2 text-center text-sm text-[var(--muted)]">
        The test opens in fullscreen and the timer starts immediately.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}
