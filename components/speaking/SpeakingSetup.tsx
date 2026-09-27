"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { IssueList } from "@/components/setup/IssueList";
import { parseJson, parseSpeakingTest, type SpeakingTest, type ValidationIssue } from "@/lib/schema";
import { recordingSupported, speak, speechSupported } from "@/lib/speech";
import { useSpeakingStore } from "@/lib/speakingStore";
import { MicLevel } from "./MicLevel";

function read(text: string): { test: SpeakingTest | null; issues: ValidationIssue[] } {
  const json = parseJson(text);
  if (!json.ok) return { test: null, issues: json.issues };
  const parsed = parseSpeakingTest(json.value);
  return parsed.ok ? { test: parsed.value, issues: [] } : { test: null, issues: parsed.issues };
}

const noopSubscribe = () => () => {};

type MicState = "idle" | "asking" | "ready" | "denied";

export function SpeakingSetup({
  testTitle,
  file,
}: {
  testTitle: string;
  file: { text: string; filename: string };
}) {
  const router = useRouter();
  const { test, issues } = useMemo(() => read(file.text), [file.text]);

  const stream = useSpeakingStore((s) => s.stream);
  const setStream = useSpeakingStore((s) => s.setStream);
  const voice = useSpeakingStore((s) => s.voice);
  const setVoice = useSpeakingStore((s) => s.setVoice);
  const start = useSpeakingStore((s) => s.start);

  const [mic, setMic] = useState<MicState>(stream ? "ready" : "idle");
  const [starting, setStarting] = useState(false);

  // Browser capabilities, read without a hydration mismatch.
  const canRecord = useSyncExternalStore(noopSubscribe, recordingSupported, () => true);
  const canSpeak = useSyncExternalStore(noopSubscribe, speechSupported, () => true);

  async function askMic() {
    setMic("asking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setStream(s);
      setMic("ready");
    } catch {
      setMic("denied");
    }
  }

  function onStart() {
    if (!test || !stream) return;
    setStarting(true);
    start(test);
    router.push("/speaking");
  }

  const questionCount = test
    ? test.part1.topics.reduce((n, t) => n + t.questions.length, 0) +
      1 +
      (test.part2.followUp?.length ?? 0) +
      test.part3.topics.reduce((n, t) => n + t.questions.length, 0)
    : 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-[var(--muted)] underline">
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{testTitle} — Speaking</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        The examiner&apos;s questions are read aloud and your answers are recorded, so you can
        listen back afterwards. Recordings stay in this browser tab and are never uploaded.
      </p>

      <IssueList title={file.filename} issues={issues} />

      {test && (
        <section className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-5">
          <h2 className="text-lg font-semibold">{test.title}</h2>
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <Stat label="Parts" value="3" />
            <Stat label="Questions" value={String(questionCount)} />
            <Stat label="Time" value="11–14 minutes" />
          </dl>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="w-16 shrink-0 font-semibold">Part 1</span>
              <span>Questions about yourself and familiar topics (4–5 minutes)</span>
            </li>
            <li className="flex gap-3">
              <span className="w-16 shrink-0 font-semibold">Part 2</span>
              <span>
                A cue card: {test.part2.prepSeconds} seconds to prepare, then speak for up to{" "}
                {Math.round(test.part2.speakSeconds / 60)} minutes
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-16 shrink-0 font-semibold">Part 3</span>
              <span>A discussion of more abstract questions (4–5 minutes)</span>
            </li>
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-[var(--border)] p-4">
        <h2 className="font-semibold">Microphone</h2>
        {!canRecord ? (
          <p className="mt-2 text-sm text-[var(--incorrect)]">
            This browser can&apos;t record audio. Use a recent Chrome, Edge, Firefox or Safari.
          </p>
        ) : mic === "ready" ? (
          <div className="mt-2 text-sm">
            <p>
              <span className="text-[var(--correct)]">✓</span> Microphone ready. Say a few words —
              the bar should move.
            </p>
            <MicLevel stream={stream} className="mt-3 max-w-sm" />
          </div>
        ) : (
          <div className="mt-2 text-sm">
            <p className="text-[var(--muted)]">
              Allow microphone access so your answers can be recorded.
            </p>
            {mic === "denied" && (
              <p className="mt-2 text-[var(--incorrect)]">
                Access was blocked. Allow the microphone in your browser&apos;s site settings, then
                try again.
              </p>
            )}
            <button
              type="button"
              onClick={() => void askMic()}
              disabled={mic === "asking"}
              className="mt-3 rounded border border-[var(--border-strong)] px-4 py-2 font-medium disabled:opacity-50"
            >
              {mic === "asking" ? "Waiting for permission…" : "Allow microphone"}
            </button>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-[var(--border)] p-4 text-sm">
        <h2 className="font-semibold">Examiner voice</h2>
        {canSpeak ? (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
              Read the questions aloud
            </label>
            <button
              type="button"
              onClick={() => speak("Hello. I'm your examiner for the Speaking test.")}
              className="rounded border border-[var(--border-strong)] px-3 py-1.5 font-medium"
            >
              Play a sample
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[var(--muted)]">
            This browser has no speech voice, so questions will be shown on screen only.
          </p>
        )}
        <p className="mt-2 text-[var(--muted)]">
          Use headphones if you can, so the examiner&apos;s voice isn&apos;t picked up in your
          recordings.
        </p>
      </section>

      <button
        type="button"
        disabled={!test || !stream || starting}
        onClick={onStart}
        className="mt-6 w-full rounded-lg bg-[var(--accent)] px-6 py-3.5 text-base font-semibold text-[var(--accent-fg)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {starting ? "Starting…" : "Start test"}
      </button>
      <p className="mt-2 text-center text-sm text-[var(--muted)]">
        The test opens in fullscreen and the examiner begins straight away.
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
