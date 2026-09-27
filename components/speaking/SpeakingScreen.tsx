"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildScript, type Step } from "@/lib/speakingScript";
import { record, speak } from "@/lib/speech";
import { useSpeakingStore } from "@/lib/speakingStore";
import { useFullscreen } from "@/lib/useFullscreen";
import { formatClock, useCountdown } from "@/lib/useTimer";
import type { SpeakingTest } from "@/lib/schema";
import { Modal } from "@/components/test/Modal";
import { FullscreenBanner, TestHeader } from "@/components/test/TestHeader";
import { MicLevel } from "./MicLevel";

const DEFAULT_INSTRUCTIONS =
  "The Speaking test has three parts and takes 11–14 minutes.\n\nPart 1: the examiner asks you questions about yourself and familiar topics.\n\nPart 2: you get a topic card and one minute to prepare, then speak for one to two minutes.\n\nPart 3: the examiner asks more general questions linked to the Part 2 topic.\n\nAfter each answer, press Next to move on — in the real test the examiner decides when to move on.";

/** Where the current step is: the examiner talking, or the candidate's turn. */
type Stage = "examiner" | "candidate";

type Position = {
  index: number;
  stage: Stage;
  /** Countdown deadline for the Part 2 preparation and long turn. */
  endsAt: number | null;
  /** When the current answer started, for the elapsed clock. */
  answerStart: number | null;
};

export function SpeakingScreen() {
  const router = useRouter();
  const session = useSpeakingStore((s) => s.session);
  const stream = useSpeakingStore((s) => s.stream);
  const voice = useSpeakingStore((s) => s.voice);
  const finished = session?.finishedAt != null;

  useEffect(() => {
    if (!session || (!stream && !finished)) router.replace("/");
    else if (finished) router.replace("/speaking/results");
  }, [session, stream, finished, router]);

  if (!session || !stream || finished) return null;
  return <Runner test={session.test} stream={stream} voice={voice} />;
}

function Runner({
  test,
  stream,
  voice,
}: {
  test: SpeakingTest;
  stream: MediaStream;
  voice: boolean;
}) {
  const router = useRouter();
  const addClip = useSpeakingStore((s) => s.addClip);
  const finish = useSpeakingStore((s) => s.finish);
  const notes = useSpeakingStore((s) => s.session?.notes ?? "");
  const setNotes = useSpeakingStore((s) => s.setNotes);
  const { enter } = useFullscreen();

  const steps = useMemo(() => buildScript(test), [test]);
  const [pos, setPos] = useState<Position>({
    index: 0,
    stage: "examiner",
    endsAt: null,
    answerStart: null,
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const posRef = useRef(pos);
  const recRef = useRef<ReturnType<typeof record> | null>(null);
  const speechRef = useRef<ReturnType<typeof speak> | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const entered = useRef(false);
  useEffect(() => {
    if (!entered.current) {
      entered.current = true;
      void enter();
    }
  }, [enter]);

  // Recordings live only in memory, so leaving the page loses them.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  /** Stops the running recording, if any, and files it against its step. */
  const saveRecording = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    const step = steps[posRef.current.index];
    const clip = await rec.stop();
    addClip({
      ...clip,
      stepId: step.id,
      part: step.part,
      prompt:
        step.kind === "question" ? step.text : step.kind === "longTurn" ? test.part2.topic : "",
    });
  }, [steps, addClip, test.part2.topic]);

  const advance = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      speechRef.current?.cancel();
      await saveRecording();
      const index = posRef.current.index + 1;
      const next = steps[index];
      if (!next) return;
      const endsAt =
        next.kind === "prepare"
          ? Date.now() + test.part2.prepSeconds * 1000
          : next.kind === "longTurn"
            ? Date.now() + test.part2.speakSeconds * 1000
            : null;
      setPos({
        index,
        stage: next.kind === "longTurn" || next.kind === "prepare" ? "candidate" : "examiner",
        endsAt,
        answerStart: next.kind === "longTurn" ? Date.now() : null,
      });
    } finally {
      busy.current = false;
    }
  }, [steps, saveRecording, test.part2.prepSeconds, test.part2.speakSeconds]);

  const endTest = useCallback(async () => {
    speechRef.current?.cancel();
    await saveRecording();
    finish();
    router.replace("/speaking/results");
  }, [saveRecording, finish, router]);

  // Runs each step: the examiner speaks, then the candidate's turn begins.
  const step = steps[pos.index];
  useEffect(() => {
    let cancelled = false;
    let started: ReturnType<typeof record> | null = null;
    const say = async (text: string) => {
      if (!voice) return;
      const s = speak(text);
      speechRef.current = s;
      await s.done;
      if (speechRef.current === s) speechRef.current = null;
    };
    const startRecording = () => {
      started = record(stream);
      recRef.current = started;
    };

    const run = async () => {
      if (step.kind === "longTurn") {
        startRecording();
        return;
      }
      if (step.kind === "say") {
        await say(step.text);
        if (!cancelled && voice) void advance();
      } else if (step.kind === "question") {
        await say(step.spoken);
        if (cancelled) return;
        startRecording();
        setPos((p) => ({ ...p, stage: "candidate", answerStart: Date.now() }));
      } else if (step.kind === "end") {
        await say("Thank you. That is the end of the Speaking test.");
      }
    };
    void run();

    return () => {
      cancelled = true;
      speechRef.current?.cancel();
      // `advance` files a recording before moving on, so one still here was
      // never finished — the step was torn down (unmount, or dev re-run).
      if (started && recRef.current === started) {
        recRef.current = null;
        void started.stop().then((r) => URL.revokeObjectURL(r.url));
      }
    };
    // Each step runs once; `advance` and `voice` are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // The Part 2 clocks. Preparation hands over to the long turn; the long turn
  // is cut off when time is up, as the examiner would.
  const onExpire = useCallback(() => void advance(), [advance]);
  const remaining = useCountdown(pos.endsAt, onExpire);

  const partSteps = steps.filter(
    (s) => s.part === step.part && (s.kind === "question" || s.kind === "longTurn"),
  );
  const answerNo = partSteps.findIndex((s) => s.id === step.id) + 1;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TestHeader
        title={test.title}
        remaining={pos.endsAt === null ? null : remaining}
        clockLabel={step.kind === "prepare" ? "Preparation time" : "Speaking time"}
        warnAt={10}
        onShowInstructions={() => setShowInstructions(true)}
        onSubmit={() => setConfirmEnd(true)}
      />
      <FullscreenBanner note="The test is still running." />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl">
          {step.kind === "prepare" || step.kind === "longTurn" ? (
            <LongTurn
              test={test}
              preparing={step.kind === "prepare"}
              notes={notes}
              onNotes={setNotes}
              stream={stream}
              answerStart={pos.answerStart}
              onDone={() => void advance()}
            />
          ) : (
            <ExaminerTurn
              step={step}
              stage={pos.stage}
              voice={voice}
              stream={stream}
              answerStart={pos.answerStart}
              isLast={steps[pos.index + 1]?.kind === "end"}
              onRepeat={() => step.kind === "question" && speak(step.text)}
              onNext={() => void advance()}
              onSkip={() => (speechRef.current ? speechRef.current.cancel() : void advance())}
              onFinish={() => void endTest()}
            />
          )}
        </div>
      </main>

      <PartBar part={step.part} answerNo={answerNo} answerCount={partSteps.length} />

      {showInstructions && (
        <Modal title="Test Instructions" onClose={() => setShowInstructions(false)}>
          <p className="whitespace-pre-line leading-relaxed">
            {test.instructions ?? DEFAULT_INSTRUCTIONS}
          </p>
        </Modal>
      )}

      {confirmEnd && (
        <Modal
          title="End test"
          onClose={() => setConfirmEnd(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="rounded border border-[var(--border-strong)] px-4 py-2 font-medium"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => void endTest()}
                className="rounded bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-fg)]"
              >
                End now
              </button>
            </>
          }
        >
          <p className="leading-relaxed">
            The test will stop here. Everything you have recorded so far is kept for review.
          </p>
        </Modal>
      )}
    </div>
  );
}

function ExaminerTurn({
  step,
  stage,
  voice,
  stream,
  answerStart,
  isLast,
  onRepeat,
  onNext,
  onSkip,
  onFinish,
}: {
  step: Step;
  stage: Stage;
  voice: boolean;
  stream: MediaStream;
  answerStart: number | null;
  isLast: boolean;
  onRepeat: () => void;
  onNext: () => void;
  /** Cuts the examiner short, or continues when there is no voice. */
  onSkip: () => void;
  onFinish: () => void;
}) {
  const talking = stage === "examiner" && voice && step.kind !== "end";

  return (
    <>
      <section className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-panel)] px-6 py-6">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Examiner
          {talking && <SpeakingBars />}
        </div>
        {step.kind === "question" && step.topic && (
          <p className="mt-3 text-sm text-[var(--muted)]">{step.topic}</p>
        )}
        <p
          className={`mt-2 leading-relaxed ${step.kind === "question" ? "text-2xl font-semibold" : "text-lg"}`}
        >
          {step.kind === "question" || step.kind === "say"
            ? step.text
            : "Thank you. That is the end of the Speaking test."}
        </p>
      </section>

      <section className="mt-6 rounded-lg border border-[var(--border)] px-6 py-5">
        {step.kind === "end" ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>Well done. You can now listen back to your answers.</p>
            <button
              type="button"
              onClick={onFinish}
              className="rounded bg-[var(--accent)] px-5 py-2.5 font-semibold text-[var(--accent-fg)]"
            >
              See your recordings
            </button>
          </div>
        ) : step.kind === "question" && stage === "candidate" ? (
          <div className="flex flex-wrap items-center gap-5">
            <Recording stream={stream} since={answerStart} />
            <button
              type="button"
              onClick={onRepeat}
              className="rounded border border-[var(--border-strong)] px-3 py-2 text-sm font-medium"
            >
              Repeat question
            </button>
            <button
              type="button"
              onClick={onNext}
              className="ml-auto rounded bg-[var(--accent)] px-5 py-2.5 font-semibold text-[var(--accent-fg)]"
            >
              {isLast ? "Finish" : "Next question →"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[var(--muted)]">
              {voice ? "Listen to the examiner…" : "Read the examiner's words, then continue."}
            </p>
            <button
              type="button"
              onClick={onSkip}
              className="rounded border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
            >
              {voice ? "Skip" : "Continue →"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function LongTurn({
  test,
  preparing,
  notes,
  onNotes,
  stream,
  answerStart,
  onDone,
}: {
  test: SpeakingTest;
  preparing: boolean;
  notes: string;
  onNotes: (text: string) => void;
  stream: MediaStream;
  answerStart: number | null;
  onDone: () => void;
}) {
  const { part2 } = test;
  return (
    <>
      <section className="border-2 border-[var(--border-strong)] bg-[var(--bg-raised)] px-6 py-5">
        <p className="text-lg font-bold leading-snug">{part2.topic}</p>
        <p className="mt-4">You should say:</p>
        <ul className="mt-1 space-y-0.5 pl-6">
          {part2.points.map((p) => (
            <li key={p} className="list-disc">
              {p}
            </li>
          ))}
        </ul>
        {part2.closing && <p className="mt-2">{part2.closing}</p>}
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="p2-notes" className="text-sm font-semibold">
            Notes
          </label>
          <textarea
            id="p2-notes"
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            readOnly={!preparing}
            spellCheck={false}
            autoFocus
            rows={6}
            placeholder={preparing ? "Jot down a few key words…" : ""}
            className="mt-1 w-full resize-none rounded-sm p-3 leading-relaxed"
          />
        </div>
        <div className="flex flex-col justify-end gap-4 md:w-60">
          {preparing ? (
            <p className="text-sm text-[var(--muted)]">
              Prepare your talk. You will be asked to start when the time is up.
            </p>
          ) : (
            <Recording stream={stream} since={answerStart} />
          )}
          <button
            type="button"
            onClick={onDone}
            className="rounded bg-[var(--accent)] px-5 py-2.5 font-semibold text-[var(--accent-fg)]"
          >
            {preparing ? "I'm ready to speak" : "Finish speaking"}
          </button>
        </div>
      </section>
    </>
  );
}

function Recording({ stream, since }: { stream: MediaStream; since: number | null }) {
  const elapsed = useElapsed(since);
  return (
    <div className="min-w-48">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--incorrect)]" />
        Recording <span className="tabular-nums">{formatClock(elapsed)}</span>
      </p>
      <MicLevel stream={stream} className="mt-2" />
    </div>
  );
}

function useElapsed(since: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [since]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}

function SpeakingBars() {
  return (
    <span aria-label="speaking" className="flex h-3 items-end gap-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1 animate-pulse rounded-sm bg-[var(--accent)]"
          style={{ height: "100%", animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function PartBar({
  part,
  answerNo,
  answerCount,
}: {
  part: number;
  answerNo: number;
  answerCount: number;
}) {
  return (
    <nav
      aria-label="Test progress"
      className="shrink-0 border-t border-[var(--border-strong)] bg-[var(--bg-panel)]"
    >
      <div className="flex items-center gap-4 px-4 py-2.5">
        {[1, 2, 3].map((p) => (
          <span
            key={p}
            aria-current={p === part ? "step" : undefined}
            className={`rounded px-2 py-1 text-xs font-bold uppercase tracking-wide ${
              p === part
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : p < part
                  ? "text-[var(--fg)]"
                  : "text-[var(--muted)]"
            }`}
          >
            Part {p}
          </span>
        ))}
        {answerNo > 0 && (
          <span className="ml-auto text-sm tabular-nums text-[var(--muted)]">
            {part === 2 && answerNo === 1 ? "Long turn" : `Question ${answerNo} of ${answerCount}`}
          </span>
        )}
      </div>
    </nav>
  );
}
