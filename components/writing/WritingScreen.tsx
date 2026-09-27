"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { countWords, type WritingTask } from "@/lib/schema";
import { useFullscreen } from "@/lib/useFullscreen";
import { useCountdown } from "@/lib/useTimer";
import { useWritingStore } from "@/lib/writingStore";
import { Modal } from "@/components/test/Modal";
import { SplitPane } from "@/components/test/SplitPane";
import { FullscreenBanner, TestHeader } from "@/components/test/TestHeader";

const DEFAULT_INSTRUCTIONS =
  "Answer both parts.\n\nYou should spend about 20 minutes on Part 1 and about 40 minutes on Part 2. Part 2 contributes twice as much as Part 1 to the Writing score.\n\nThe word count is shown below each answer box.";

/**
 * The computer-delivered Writing test: the task on the left, the answer box on
 * the right, and one clock for both parts.
 */
export function WritingScreen() {
  const router = useRouter();
  const hydrated = useWritingStore((s) => s.hydrated);
  const hydrate = useWritingStore((s) => s.hydrate);
  const session = useWritingStore((s) => s.session);
  const submit = useWritingStore((s) => s.submit);
  const setActiveTask = useWritingStore((s) => s.setActiveTask);

  const { enter } = useFullscreen();
  const [showInstructions, setShowInstructions] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(hydrate, [hydrate]);

  const test = session?.test ?? null;
  const finished = session?.finishedAt != null;

  const entered = useRef(false);
  useEffect(() => {
    if (test && !finished && !entered.current) {
      entered.current = true;
      void enter();
    }
  }, [test, finished, enter]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) router.replace("/");
    else if (finished) router.replace("/writing/results");
  }, [hydrated, session, finished, router]);

  const onExpire = useCallback(() => submit("time"), [submit]);
  const remaining = useCountdown(session && !finished ? session.endsAt : null, onExpire);

  if (!session || !test || finished) return null;

  const task = test.tasks.find((t) => t.task === session.activeTask) ?? test.tasks[0];
  const counts = test.tasks.map((t) => countWords(session.responses[t.task] ?? ""));
  const short = test.tasks.filter((t, i) => counts[i] < t.minWords);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TestHeader
        title={test.title}
        remaining={remaining}
        onShowInstructions={() => setShowInstructions(true)}
        onSubmit={() => setConfirmSubmit(true)}
      />
      <FullscreenBanner />

      <div className="shrink-0 border-b border-[var(--border)] px-6 py-3">
        <div className="border border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 py-2.5">
          <p className="font-bold">Part {task.task}</p>
          <p className="mt-0.5 text-sm">
            You should spend about {task.minutes} minutes on this task. Write at least{" "}
            {task.minWords} words.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <SplitPane left={<TaskPrompt task={task} />} right={<AnswerBox key={task.task} task={task} />} />
      </div>

      <PartBar
        tasks={test.tasks}
        counts={counts}
        active={task.task}
        onSelect={setActiveTask}
      />

      {showInstructions && (
        <Modal title="Test Instructions" onClose={() => setShowInstructions(false)}>
          <p className="whitespace-pre-line leading-relaxed">
            {test.instructions ?? DEFAULT_INSTRUCTIONS}
          </p>
        </Modal>
      )}

      {confirmSubmit && (
        <Modal
          title="Submit test"
          onClose={() => setConfirmSubmit(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="rounded border border-[var(--border-strong)] px-4 py-2 font-medium"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={() => submit("manual")}
                className="rounded bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-fg)]"
              >
                Submit now
              </button>
            </>
          }
        >
          <p className="leading-relaxed">
            {short.length === 0
              ? "Both parts meet the minimum word count."
              : short
                  .map(
                    (t) =>
                      `Part ${t.task} has ${counts[test.tasks.indexOf(t)]} words (minimum ${t.minWords}).`,
                  )
                  .join(" ")}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            You will see your answers for review. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

export function TaskPrompt({ task }: { task: WritingTask }) {
  return (
    <div className="h-full overflow-y-auto px-6 py-5 leading-relaxed">
      {task.lead && <p className="mb-3">{task.lead}</p>}
      <div className="space-y-3 border border-[var(--border-strong)] px-4 py-3 font-semibold italic">
        {task.prompt.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {task.after?.map((p, i) => (
        <p key={i} className="mt-3">
          {p}
        </p>
      ))}
      {task.image && (
        // A plain <img>: the figures are local scans of unknown size, and
        // next/image's optimiser adds nothing for a single static file.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={task.image.src}
          alt={task.image.alt}
          className="mt-5 w-full max-w-2xl rounded border border-[var(--border)] bg-white p-3"
        />
      )}
    </div>
  );
}

function AnswerBox({ task }: { task: WritingTask }) {
  const text = useWritingStore((s) => s.session?.responses[task.task] ?? "");
  const write = useWritingStore((s) => s.write);
  const words = countWords(text);

  return (
    <div className="flex h-full flex-col px-6 py-5">
      <label htmlFor={`answer-${task.task}`} className="sr-only">
        Your answer to Part {task.task}
      </label>
      <textarea
        id={`answer-${task.task}`}
        value={text}
        onChange={(e) => write(task.task, e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        autoFocus
        className="min-h-0 flex-1 resize-none rounded-sm p-3 leading-relaxed"
      />
      <p className="mt-2 text-sm tabular-nums" aria-live="polite">
        Words: <span className="font-semibold">{words}</span>
      </p>
    </div>
  );
}

function PartBar({
  tasks,
  counts,
  active,
  onSelect,
}: {
  tasks: WritingTask[];
  counts: number[];
  active: number;
  onSelect: (task: number) => void;
}) {
  const index = tasks.findIndex((t) => t.task === active);
  const step = (delta: number) => {
    const next = tasks[index + delta];
    if (next) onSelect(next.task);
  };

  return (
    <nav
      aria-label="Part navigation"
      className="shrink-0 border-t border-[var(--border-strong)] bg-[var(--bg-panel)]"
    >
      <div className="flex items-stretch gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={index <= 0}
          aria-label="Previous part"
          className="shrink-0 rounded border border-[var(--border-strong)] px-3 text-lg disabled:opacity-30"
        >
          ‹
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
          {tasks.map((t, i) => {
            const isActive = t.task === active;
            const met = counts[i] >= t.minWords;
            return (
              <button
                key={t.task}
                type="button"
                onClick={() => onSelect(t.task)}
                aria-current={isActive || undefined}
                className={`flex shrink-0 items-center gap-2 rounded px-3 py-1 text-sm ${
                  isActive ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wide">Part {t.task}</span>
                <span className={`tabular-nums ${isActive ? "" : "text-[var(--muted)]"}`}>
                  {counts[i]} / {t.minWords} words
                </span>
                <span
                  aria-hidden
                  className="h-[2px] w-4 rounded"
                  style={{ background: met ? "var(--answered)" : "transparent" }}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={index < 0 || index >= tasks.length - 1}
          aria-label="Next part"
          className="shrink-0 rounded border border-[var(--border-strong)] px-3 text-lg disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </nav>
  );
}
