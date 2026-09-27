"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NO_RESPONSES, useTestStore } from "@/lib/store";
import { useCountdown } from "@/lib/useTimer";
import { useFullscreen } from "@/lib/useFullscreen";
import { answeredSet, navEntries } from "@/lib/progress";
import { GroupView } from "@/components/questions/GroupView";
import { AudioRunner, VolumeControl } from "./AudioRunner";
import { Modal } from "./Modal";
import { NavBar } from "./NavBar";
import { NotesButton, NotesPanel } from "./NotesPanel";
import { Passage } from "./Passage";
import { SplitPane } from "./SplitPane";
import { FullscreenBanner, TestHeader } from "./TestHeader";

export function TestScreen() {
  const router = useRouter();
  const hydrated = useTestStore((s) => s.hydrated);
  const session = useTestStore((s) => s.session);
  const phase = useTestStore((s) => s.phase);
  const submit = useTestStore((s) => s.submit);
  const setActivePart = useTestStore((s) => s.setActivePart);

  const { enter } = useFullscreen();

  const [showInstructions, setShowInstructions] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const questionsRef = useRef<HTMLDivElement>(null);

  const test = session?.test ?? null;

  // Fullscreen is requested from the Start click's gesture, which is still
  // live during this first mount.
  const entered = useRef(false);
  useEffect(() => {
    if (test && !entered.current) {
      entered.current = true;
      void enter();
    }
  }, [test, enter]);

  const onExpire = useCallback(() => submit("time"), [submit]);
  const remaining = useCountdown(session?.endsAt ?? null, onExpire);

  useEffect(() => {
    // Wait for the stored session to be read back, or a refresh mid-test
    // bounces home before it is recovered.
    if (!hydrated) return;
    if (phase === "finished") router.replace("/results");
    else if (phase === "idle") router.replace("/");
  }, [hydrated, phase, router]);

  const answered = useMemo(
    () => (test ? answeredSet(test, session?.responses ?? NO_RESPONSES) : new Set<number>()),
    [test, session?.responses],
  );
  const unanswered = useMemo(
    () => (test ? navEntries(test).filter((e) => !answered.has(e.n)).length : 0),
    [test, answered],
  );

  const goTo = useCallback(
    (n: number, part: number) => {
      setActivePart(part);
      // The part switch renders first; scroll on the next frame.
      requestAnimationFrame(() => {
        document.getElementById(`q-${n}`)?.scrollIntoView({ block: "center" });
      });
    },
    [setActivePart],
  );

  if (!session || !test) return null;

  const activePart =
    test.parts.find((p) => p.part === session.activePart) ?? test.parts[0];

  const questionsPane = (
    <div ref={questionsRef} className="h-full overflow-y-auto px-6 py-5">
      {activePart.instructions && (
        <div className="mb-5 whitespace-pre-line border border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 py-3 font-medium leading-relaxed">
          {activePart.instructions}
        </div>
      )}
      {activePart.groups.map((group, i) => (
        <GroupView key={i} group={group} />
      ))}
      <div className="h-24" />
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TestHeader
        title={test.title}
        remaining={remaining}
        onShowInstructions={() => setShowInstructions(true)}
        onSubmit={() => setConfirmSubmit(true)}
      >
        {test.type === "reading" && (
          <NotesButton onClick={() => setOpenNote(openNote ?? firstNoteId())} />
        )}
      </TestHeader>

      <FullscreenBanner />

      {test.type === "reading" && activePart.passage ? (
        <div className="flex min-h-0 flex-1">
          <SplitPane
            left={<Passage passage={activePart.passage} onOpenNote={setOpenNote} />}
            right={questionsPane}
          />
          <NotesPanel
            openId={openNote}
            onClose={() => setOpenNote(null)}
            onSelect={setOpenNote}
          />
        </div>
      ) : (
        <div className="mx-auto min-h-0 w-full max-w-3xl flex-1">{questionsPane}</div>
      )}

      <NavBar test={test} onGoTo={goTo} />

      {test.type === "listening" && (
        <>
          <AudioRunner test={test} />
          <div className="pointer-events-auto fixed bottom-16 right-4 z-40">
            <VolumeControl />
          </div>
        </>
      )}

      {showInstructions && (
        <Modal title="Test Instructions" onClose={() => setShowInstructions(false)}>
          <p className="whitespace-pre-line leading-relaxed">
            {test.instructions ?? "No instructions were supplied with this test file."}
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
            {unanswered > 0
              ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. They will be marked incorrect.`
              : "All questions are answered."}
          </p>
          <p className="mt-3 text-sm text-[var(--muted)]">
            You will see your score and a full answer review. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}

function firstNoteId(): string | null {
  return useTestStore.getState().session?.notes[0]?.id ?? null;
}
