import type { ValidationIssue } from "@/lib/schema";

export function IssueList({ title, issues }: { title: string; issues: ValidationIssue[] }) {
  if (issues.length === 0) return null;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <section className="mt-6 rounded-lg border border-[var(--border)] p-4">
      <h2 className="font-semibold">{title}</h2>
      {[
        { list: errors, tone: "var(--incorrect)", word: "Must fix" },
        { list: warnings, tone: "var(--muted)", word: "Worth checking" },
      ]
        .filter((g) => g.list.length > 0)
        .map((g) => (
          <div key={g.word} className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: g.tone }}>
              {g.word} ({g.list.length})
            </p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {g.list.map((issue, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden style={{ color: g.tone }}>
                    •
                  </span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
