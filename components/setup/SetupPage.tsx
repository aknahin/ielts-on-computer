"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDrop } from "./FileDrop";
import { IssueList } from "./IssueList";
import { SampleTests, type SampleFiles } from "./SampleTests";
import { useTestStore } from "@/lib/store";
import { formatDuration } from "@/lib/useTimer";
import {
  parseAnswerKey,
  parseJson,
  parseTest,
  testQuestionNumbers,
  validateAgainstAnswers,
  validateTestInternals,
  type AnswerKey,
  type Test,
  type TestType,
  type ValidationIssue,
} from "@/lib/schema";

type Slot<T> = {
  filename: string | null;
  value: T | null;
  issues: ValidationIssue[];
};

const EMPTY = { filename: null, value: null, issues: [] };

function readQuestions(text: string, filename: string): Slot<Test> {
  const json = parseJson(text);
  if (!json.ok) return { filename, value: null, issues: json.issues };
  const parsed = parseTest(json.value);
  if (!parsed.ok) return { filename, value: null, issues: parsed.issues };
  const issues = validateTestInternals(parsed.value);
  const fatal = issues.some((i) => i.level === "error");
  return { filename, value: fatal ? null : parsed.value, issues };
}

function readAnswers(text: string, filename: string): Slot<AnswerKey> {
  const json = parseJson(text);
  if (!json.ok) return { filename, value: null, issues: json.issues };
  const parsed = parseAnswerKey(json.value);
  return {
    filename,
    value: parsed.ok ? parsed.value : null,
    issues: parsed.ok ? [] : parsed.issues,
  };
}

type AudioProbe = { part: number; url: string; state: "pending" | "ok" | "failed" };

/** A test from the `contents/` library, loaded without any file picking. */
export type SetupPreset = { testTitle: string; files: SampleFiles };

export function SetupPage({ type, preset }: { type: TestType; preset?: SetupPreset }) {
  const router = useRouter();
  const start = useTestStore((s) => s.start);

  // Library tests arrive with their files already read on the server; they go
  // through the same validation as a drop, so a broken file still shows why.
  const [questions, setQuestions] = useState<Slot<Test>>(() =>
    preset ? readQuestions(preset.files.questions.text, preset.files.questions.filename) : EMPTY,
  );
  const [answers, setAnswers] = useState<Slot<AnswerKey>>(() =>
    preset ? readAnswers(preset.files.answers.text, preset.files.answers.filename) : EMPTY,
  );
  const [probeState, setProbeState] = useState<Record<string, "ok" | "failed">>({});
  const [starting, setStarting] = useState(false);

  const test = questions.value;
  const key = answers.value;

  const crossIssues = useMemo(
    () => (test && key ? validateAgainstAnswers(test, key) : []),
    [test, key],
  );

  const wrongType = test !== null && test.type !== type;

  const handleQuestions = useCallback(
    (text: string, filename: string) => setQuestions(readQuestions(text, filename)),
    [],
  );

  const handleAnswers = useCallback(
    (text: string, filename: string) => setAnswers(readAnswers(text, filename)),
    [],
  );

  /** Fills both slots from the bundled demo, as if the files had been dropped. */
  const loadSample = useCallback(
    (files: SampleFiles) => {
      handleQuestions(files.questions.text, files.questions.filename);
      handleAnswers(files.answers.text, files.answers.filename);
    },
    [handleQuestions, handleAnswers],
  );

  const tracks = useMemo(
    () => (test?.type === "listening" ? (test.audio ?? []) : []),
    [test],
  );

  /**
   * Listening audio can't be paused once the test starts, so every recording
   * is checked here. A part that won't load must be fixed before starting,
   * not discovered halfway through Part 3.
   *
   * Results are keyed by URL, so loading a different file simply has no
   * entries yet — no reset pass is needed.
   */
  useEffect(() => {
    if (tracks.length === 0) return;

    let cancelled = false;
    const settle = (url: string, state: "ok" | "failed") => {
      if (cancelled) return;
      setProbeState((prev) => (prev[url] === state ? prev : { ...prev, [url]: state }));
    };

    const elements = tracks.map((entry) => {
      const el = new Audio();
      el.preload = "auto";
      // Deliberately no `crossOrigin`: playback doesn't set it either, and
      // requiring CORS here would block Start on files that play perfectly.
      // `canplay` is enough to know the URL resolves; some servers never let
      // `canplaythrough` fire without a full download.
      el.addEventListener("canplay", () => settle(entry.url, "ok"), { once: true });
      el.addEventListener("canplaythrough", () => settle(entry.url, "ok"), { once: true });
      el.addEventListener("error", () => settle(entry.url, "failed"), { once: true });
      el.src = entry.url;
      el.load();
      return el;
    });

    return () => {
      cancelled = true;
      for (const el of elements) {
        el.src = "";
        el.load();
      }
    };
  }, [tracks]);

  const probes: AudioProbe[] = useMemo(
    () => tracks.map((t) => ({ part: t.part, url: t.url, state: probeState[t.url] ?? "pending" })),
    [tracks, probeState],
  );

  const audioReady =
    test?.type !== "listening" || (probes.length > 0 && probes.every((p) => p.state === "ok"));

  const ready = test !== null && key !== null && !wrongType && audioReady;

  const summary = useMemo(() => {
    if (!test) return null;
    return {
      count: testQuestionNumbers(test).length,
      parts: test.parts.length,
      duration: formatDuration(test.durationSeconds),
    };
  }, [test]);

  function onStart() {
    if (!test || !key) return;
    setStarting(true);
    // Fullscreen and audio both need this click as their user gesture; the
    // test page picks it up from the store on mount.
    start(test, key);
    router.push("/test");
  }

  const label = type === "listening" ? "Listening" : "Reading";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-[var(--muted)] underline">
        ← Back
      </Link>
      {preset ? (
        <>
          <h1 className="mt-3 text-2xl font-bold">
            {preset.testTitle} — {label}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Loaded from the test library. Check the details below, then start when you are ready.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-3 text-2xl font-bold">Load a {label} test</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Both files are validated before the test can start. Nothing is uploaded anywhere — the
            files are read in your browser.
          </p>
        </>
      )}

      {!preset && (
        <div className="mt-8 grid gap-4">
          <FileDrop
            label="Questions file"
            hint={`e.g. samples/demo-${type}.questions.json`}
            filename={questions.filename}
            status={questions.filename === null ? "empty" : questions.value ? "ok" : "error"}
            onText={handleQuestions}
          />
          <FileDrop
            label="Answers file"
            hint={`e.g. samples/demo-${type}.answers.json`}
            filename={answers.filename}
            status={answers.filename === null ? "empty" : answers.value ? "ok" : "error"}
            onText={handleAnswers}
          />
        </div>
      )}

      {!preset && questions.filename === null && <SampleTests type={type} onLoad={loadSample} />}

      {wrongType && (
        <IssueList
          title="Wrong test type"
          issues={[
            {
              level: "error",
              message: `This file is a "${test.type}" test, but you opened the ${label} page. Go back and pick ${test.type}.`,
            },
          ]}
        />
      )}

      <IssueList title="Questions file" issues={questions.issues} />
      <IssueList title="Answers file" issues={answers.issues} />
      <IssueList title="Questions vs answers" issues={crossIssues} />

      {probes.length > 0 && (
        <section className="mt-6 rounded-lg border border-[var(--border)] p-4">
          <h2 className="font-semibold">Audio</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Every recording is buffered before the test starts, because playback cannot be paused
            once it begins.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {probes.map((p) => (
              <li key={`${p.part}-${p.url}`} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className={
                    p.state === "ok"
                      ? "text-[var(--correct)]"
                      : p.state === "failed"
                        ? "text-[var(--incorrect)]"
                        : "text-[var(--muted)]"
                  }
                >
                  {p.state === "ok" ? "✓" : p.state === "failed" ? "✕" : "…"}
                </span>
                <span className="font-medium">Part {p.part}</span>
                <span className="min-w-0 truncate text-[var(--muted)]">{p.url}</span>
              </li>
            ))}
          </ul>
          {probes.some((p) => p.state === "failed") && (
            <p className="mt-3 text-sm text-[var(--incorrect)]">
              A recording could not be loaded. Check the URL is reachable and allows cross-origin
              playback.
            </p>
          )}
        </section>
      )}

      {summary && test && (
        <section className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-lg font-semibold">{test.title}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <Stat label="Questions" value={String(summary.count)} />
            <Stat label={test.type === "reading" ? "Passages" : "Parts"} value={String(summary.parts)} />
            <Stat label="Time" value={summary.duration} />
          </dl>
        </section>
      )}

      <button
        type="button"
        disabled={!ready || starting}
        onClick={onStart}
        className="mt-6 w-full rounded-lg bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-[var(--accent-fg)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {starting ? "Starting…" : "Start test"}
      </button>
      <p className="mt-2 text-center text-sm text-[var(--muted)]">
        The test opens in fullscreen and the timer starts immediately.
        {type === "listening" && " Audio begins straight away."}
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
