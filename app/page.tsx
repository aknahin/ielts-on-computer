import Link from "next/link";
import { listTests, type LibrarySection, type LibraryTest } from "@/lib/contents";

const CARDS = [
  {
    href: "/setup/listening",
    title: "Listening",
    detail: "4 parts · 40 questions · ~34 minutes",
    blurb:
      "Recordings play straight through, one part after another. They cannot be paused, rewound or replayed.",
  },
  {
    href: "/setup/reading",
    title: "Reading",
    detail: "3 passages · 40 questions · 60 minutes",
    blurb:
      "Passage on the left, questions on the right. Highlight text and make notes as you read.",
  },
] as const;

const SECTION_LABEL: Record<LibrarySection["section"], string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export default async function Home() {
  const library = await listTests();

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center px-6 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">IELTS on computer</h1>
        <p className="mt-2 text-[var(--muted)]">
          A practice harness that mirrors the real test player. Choose a test, load your question
          and answer files, then sit it under exam conditions.
        </p>
      </header>

      {library.length > 0 && (
        <section className="mb-12">
          <h2 className="text-lg font-semibold">Test library</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ready-made tests from the <code>contents/</code> folder. Pick a section to begin.
          </p>
          <ul className="mt-4 grid gap-4">
            {library.map((test) => (
              <LibraryCard key={test.slug} test={test} />
            ))}
          </ul>
        </section>
      )}

      {library.length > 0 && (
        <h2 className="mb-4 text-lg font-semibold">Or bring your own files</h2>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-6 transition-colors hover:border-[var(--border-strong)]"
          >
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">{card.detail}</p>
            <p className="mt-4 flex-1 text-sm leading-relaxed">{card.blurb}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)]">
              Load a test
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-[var(--muted)]">
        Question and answer files are plain JSON. See{" "}
        <code className="rounded bg-[var(--bg-panel)] px-1.5 py-0.5">docs/FORMAT.md</code> for the
        spec, and <code className="rounded bg-[var(--bg-panel)] px-1.5 py-0.5">samples/</code> for
        two complete Cambridge tests you can use as templates.
      </p>
    </main>
  );
}

function LibraryCard({ test }: { test: LibraryTest }) {
  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-5">
      <h3 className="text-base font-semibold">{test.title}</h3>
      {test.description && (
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{test.description}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {test.sections.map((s) => {
          const label = SECTION_LABEL[s.section];
          if (s.playable && s.complete) {
            return (
              <Link
                key={s.section}
                href={`/tests/${test.slug}/${s.section}`}
                className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
              >
                {label} →
              </Link>
            );
          }
          return (
            <span
              key={s.section}
              title={
                s.playable
                  ? "This section needs both questions.json and answers.json."
                  : "This section type is not supported yet."
              }
              className="cursor-not-allowed rounded border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)]"
            >
              {label} · {s.playable ? "files missing" : "coming soon"}
            </span>
          );
        })}
      </div>
    </li>
  );
}
