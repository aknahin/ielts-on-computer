"use client";

import { create } from "zustand";
import type { WritingTest } from "./schema";

export type WritingSession = {
  test: WritingTest;
  startedAt: number;
  /** Wall-clock ms at which the test ends. */
  endsAt: number;
  /** Essay text keyed by task number. */
  responses: Record<number, string>;
  activeTask: number;
  /** Set once the test is submitted. */
  finishedAt: number | null;
  endedBy: "time" | "manual" | null;
};

type State = {
  hydrated: boolean;
  session: WritingSession | null;
  hydrate: () => void;
  start: (test: WritingTest) => void;
  write: (task: number, text: string) => void;
  setActiveTask: (task: number) => void;
  submit: (reason: "time" | "manual") => void;
  reset: () => void;
};

const KEY = "ielts.writing";

/**
 * Mirrored to sessionStorage on every change. Unlike the Listening and Reading
 * store it is kept after submitting too, because the essays themselves are
 * the result — a refresh on the results page must not lose them.
 */
function persist(session: WritingSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage full or disabled — the in-memory session still works */
  }
}

function restore(): WritingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WritingSession) : null;
  } catch {
    return null;
  }
}

export const useWritingStore = create<State>((set, get) => ({
  hydrated: false,
  session: null,

  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true, session: get().session ?? restore() });
  },

  start: (test) => {
    const now = Date.now();
    const session: WritingSession = {
      test,
      startedAt: now,
      endsAt: now + test.durationSeconds * 1000,
      responses: {},
      activeTask: test.tasks[0].task,
      finishedAt: null,
      endedBy: null,
    };
    persist(session);
    set({ hydrated: true, session });
  },

  write: (task, text) => {
    const { session } = get();
    if (!session || session.finishedAt !== null) return;
    const next = { ...session, responses: { ...session.responses, [task]: text } };
    persist(next);
    set({ session: next });
  },

  setActiveTask: (task) => {
    const { session } = get();
    if (!session) return;
    const next = { ...session, activeTask: task };
    persist(next);
    set({ session: next });
  },

  submit: (reason) => {
    const { session } = get();
    if (!session || session.finishedAt !== null) return;
    const next = { ...session, finishedAt: Math.min(Date.now(), session.endsAt), endedBy: reason };
    persist(next);
    set({ session: next });
  },

  reset: () => {
    persist(null);
    set({ session: null });
  },
}));
