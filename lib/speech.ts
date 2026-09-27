"use client";

/**
 * The examiner's voice (browser speech synthesis) and the candidate's
 * recordings (MediaRecorder). Both are optional browser features, so every
 * entry point degrades rather than throws.
 */

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function recordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-GB" && v.localService) ??
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
  );
}

/**
 * Speaks `text` and resolves when it has finished. Speech is split into
 * sentences because Chrome silently stops long utterances after ~15 s, and
 * every sentence has a timeout because `onend` is not guaranteed to fire.
 */
export function speak(text: string): { done: Promise<void>; cancel: () => void } {
  if (!speechSupported()) return { done: Promise.resolve(), cancel: () => {} };

  const synth = window.speechSynthesis;
  const sentences = text.match(/[^.?!]+[.?!]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  let cancelled = false;
  let finish: () => void = () => {};

  const done = new Promise<void>((resolve) => {
    finish = resolve;
    const voice = pickVoice();
    let i = 0;

    const next = () => {
      if (cancelled || i >= sentences.length) return resolve();
      const sentence = sentences[i++];
      const u = new SpeechSynthesisUtterance(sentence);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "en-GB";
      u.rate = 0.95;

      let moved = false;
      const advance = () => {
        if (moved) return;
        moved = true;
        window.clearTimeout(timer);
        next();
      };
      const words = sentence.split(/\s+/).length;
      const timer = window.setTimeout(advance, 3000 + words * 600);
      u.onend = advance;
      u.onerror = advance;
      synth.speak(u);
    };

    synth.cancel();
    next();
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      synth.cancel();
      finish();
    },
  };
}

export type Recording = { blob: Blob; url: string; ms: number; ext: string };

/** Starts recording `stream`; `stop()` resolves with the finished clip. */
export function record(stream: MediaStream): { stop: () => Promise<Recording> } {
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const started = performance.now();
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  return {
    stop: () =>
      new Promise((resolve) => {
        const onStop = () => {
          const type = recorder.mimeType || chunks[0]?.type || "audio/webm";
          const blob = new Blob(chunks, { type });
          resolve({
            blob,
            url: URL.createObjectURL(blob),
            ms: performance.now() - started,
            ext: type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm",
          });
        };
        recorder.onstop = onStop;
        if (recorder.state === "inactive") onStop();
        else recorder.stop();
      }),
  };
}
