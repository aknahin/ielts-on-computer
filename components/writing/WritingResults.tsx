"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { countWords, type WritingTask } from "@/lib/schema";
import { formatDuration } from "@/lib/useTimer";
import { useWritingStore, type WritingSession } from "@/lib/writingStore";
import { TaskPrompt } from "./WritingScreen";

/** The four criteria examiners use, with the first renamed for Task 2. */
function criteria(task: number): { name: string; ask: string }[] {
  return [
    task === 1
      ? {
          name: "Task Achievement",
          ask: "Is there a clear overview? Are the key features selected, reported accurately and compared?",
        }
      : {
          name: "Task Response",
          ask: "Is every part of the question answered, with a clear position that is developed and supported?",
        },
    {
      name: "Coherence and Cohesion",
      ask: "Is it logically organised into paragraphs, with a clear progression and varied linking?",
    },
    {
      name: "Lexical Resource",
      ask: "Is vocabulary precise and varied, with few spelling or word-formation errors?",
    },
    {
      name: "Grammatical Range and Accuracy",
      ask: "Is there a mix of simple and complex sentences, and are most sentences error-free?",
    },
  ];
}

export function WritingResults() {
  const router = useRouter();
  const hydrated = useWritingStore((s) => s.hydrated);
  const hydrate = useWritingStore((s) => s.hydrate);
  const session = useWritingStore((s) => s.session);
  const reset = useWritingStore((s) => s.reset);

  useEffect(hydrate, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/");
    else if (session.finishedAt === null) router.replace("/writing");
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [hydrated, session, router]);

  if (!session || session.finishedAt === null) return null;
  const { test } = session;
  const used = Math.round((session.finishedAt - session.startedAt) / 1000);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your Writing answers</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {test.title} ·{" "}
            {session.endedBy === "time"
              ? "Time expired and the test was submitted automatically."
              : `Submitted after ${formatDuration(used)}.`}
          </p>
        </div>
        <div className="no-print flex gap-3">
          <button
            type="button"
            onClick={() => download(session)}
            className="rounded border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            Download .txt
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            Print / save PDF
          </button>
          <Link
            href="/"
            onClick={reset}
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
          >
            Back to home
          </Link>
        </div>
      </header>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Writing is marked by an examiner, so there is no automatic band score. Use the checklist
        under each answer to assess it, or share it with a teacher.
      </p>

      {test.tasks.map((task) => (
        <TaskReview key={task.task} task={task} text={session.responses[task.task] ?? ""} />
      ))}
    </main>
  );
}

function TaskReview({ task, text }: { task: WritingTask; text: string }) {
  const words = countWords(text);
  const met = words >= task.minWords;

  return (
    <section className="mt-8 rounded-lg border border-[var(--border)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-panel)] px-5 py-3">
        <h2 className="text-lg font-bold">Part {task.task}</h2>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{words}</span> words{" "}
          <span style={{ color: met ? "var(--correct)" : "var(--incorrect)" }}>
            {met ? `✓ meets the ${task.minWords}-word minimum` : `✕ under ${task.minWords} words`}
          </span>
        </p>
      </div>

      <details className="border-b border-[var(--border)]">
        <summary className="cursor-pointer px-5 py-2.5 text-sm font-medium">Show the task</summary>
        <div className="max-h-[32rem] overflow-y-auto">
          <TaskPrompt task={task} />
        </div>
      </details>

      <div className="px-5 py-4">
        {text.trim() ? (
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        ) : (
          <p className="italic text-[var(--muted)]">Nothing was written for this part.</p>
        )}
      </div>

      {!met && text.trim() && (
        <p className="mx-5 mb-4 rounded border border-[var(--border)] px-3 py-2 text-sm">
          Answers under the minimum length lose marks under{" "}
          {task.task === 1 ? "Task Achievement" : "Task Response"}.
        </p>
      )}

      <div className="border-t border-[var(--border)] px-5 py-4">
        <h3 className="text-sm font-semibold">Self-check</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {criteria(task.task).map((c) => (
            <li key={c.name}>
              <span className="font-medium">{c.name}:</span>{" "}
              <span className="text-[var(--muted)]">{c.ask}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function download(session: WritingSession): void {
  const parts = session.test.tasks.map((t) => {
    const text = session.responses[t.task] ?? "";
    return [
      `PART ${t.task} (${countWords(text)} words, minimum ${t.minWords})`,
      "",
      t.prompt.join("\n\n"),
      "",
      "---",
      "",
      text.trim(),
    ].join("\n");
  });
  const body = [session.test.title, "", ...parts].join("\n\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.test.title.replace(/[^\w-]+/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
