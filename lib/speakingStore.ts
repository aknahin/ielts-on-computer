"use client";

import { create } from "zustand";
import type { SpeakingTest } from "./schema";
import type { Recording } from "./speech";

export type Clip = Recording & {
  stepId: string;
  part: 1 | 2 | 3;
  prompt: string;
};

type Session = {
  test: SpeakingTest;
  startedAt: number;
  finishedAt: number | null;
  clips: Clip[];
  /** Part 2 preparation notes. */
  notes: string;
};

type State = {
  session: Session | null;
  /** The microphone, opened on the setup page and kept for the whole test. */
  stream: MediaStream | null;
  /** Whether the examiner reads questions aloud. */
  voice: boolean;

  setVoice: (on: boolean) => void;
  setStream: (stream: MediaStream | null) => void;
  start: (test: SpeakingTest) => void;
  addClip: (clip: Clip) => void;
  setNotes: (notes: string) => void;
  finish: () => void;
  reset: () => void;
};

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Held in memory only. Recordings are Blobs, which sessionStorage can't hold,
 * so a refresh ends the test — the screen warns before unloading.
 */
export const useSpeakingStore = create<State>((set, get) => ({
  session: null,
  stream: null,
  voice: true,

  setVoice: (voice) => set({ voice }),

  setStream: (stream) => {
    const prev = get().stream;
    if (prev && prev !== stream) stopStream(prev);
    set({ stream });
  },

  start: (test) => {
    get().session?.clips.forEach((c) => URL.revokeObjectURL(c.url));
    set({ session: { test, startedAt: Date.now(), finishedAt: null, clips: [], notes: "" } });
  },

  addClip: (clip) => {
    const { session } = get();
    if (!session) return URL.revokeObjectURL(clip.url);
    set({ session: { ...session, clips: [...session.clips, clip] } });
  },

  setNotes: (notes) => {
    const { session } = get();
    if (session) set({ session: { ...session, notes } });
  },

  finish: () => {
    const { session, stream } = get();
    stopStream(stream);
    set({
      stream: null,
      session: session && session.finishedAt === null ? { ...session, finishedAt: Date.now() } : session,
    });
  },

  reset: () => {
    const { session, stream } = get();
    session?.clips.forEach((c) => URL.revokeObjectURL(c.url));
    stopStream(stream);
    set({ session: null, stream: null });
  },
}));
