import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Test file format v1.
 *
 * Two files per test: `*.questions.json` and `*.answers.json`.
 * See docs/FORMAT.md for the prose spec and worked examples.
 * ------------------------------------------------------------------------- */

export const TEST_TYPES = ["listening", "reading"] as const;
export type TestType = (typeof TEST_TYPES)[number];

/** A block of rendered content that may contain `{{n}}` gap placeholders. */
const BodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    /** Paragraphs. `{{7}}` anywhere becomes an inline input for question 7. */
    lines: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("list"),
    ordered: z.boolean().optional(),
    items: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("notes"),
    heading: z.string().optional(),
    /** `indent: 0` is top level; 1 and 2 nest under the previous entry. */
    items: z.array(
      z.object({ text: z.string(), indent: z.number().int().min(0).max(3).default(0) }),
    ),
  }),
  z.object({
    kind: z.literal("table"),
    headers: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
]);
export type Body = z.infer<typeof BodySchema>;

const QuestionRef = z.object({
  n: z.number().int().min(1).max(200),
  /** Optional prompt. Omit when the question is a `{{n}}` gap inside `body`. */
  prompt: z.string().optional(),
});

const OptionList = z.array(z.string()).min(2);

const GroupBase = {
  instructions: z.string().optional(),
  /** Extra text shown above the questions (e.g. a scenario or heading). */
  intro: z.string().optional(),
  body: BodySchema.optional(),
};

export const GroupSchema = z.discriminatedUnion("type", [
  /** Radio list, one letter per question. Options are labelled A, B, C… */
  z.object({
    ...GroupBase,
    type: z.literal("mcq"),
    questions: z
      .array(QuestionRef.extend({ prompt: z.string(), options: OptionList }))
      .min(1),
  }),

  /** "Choose TWO letters, A–E" — one option bank, `pick` answers, `range` numbers. */
  z.object({
    ...GroupBase,
    type: z.literal("mcq-multi"),
    prompt: z.string(),
    options: OptionList,
    pick: z.number().int().min(2).max(5),
    /** Inclusive question-number range this group answers, e.g. [25, 26]. */
    range: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  }),

  /** Short text answers. Either standalone prompts or `{{n}}` gaps in `body`. */
  z.object({
    ...GroupBase,
    type: z.literal("gap"),
    /** Word limit shown beside each input, e.g. "NO MORE THAN THREE WORDS". */
    limit: z.string().optional(),
    questions: z.array(QuestionRef).min(1),
  }),

  z.object({
    ...GroupBase,
    type: z.literal("tf-ng"),
    questions: z.array(QuestionRef.extend({ prompt: z.string() })).min(1),
  }),

  z.object({
    ...GroupBase,
    type: z.literal("yn-ng"),
    questions: z.array(QuestionRef.extend({ prompt: z.string() })).min(1),
  }),

  /**
   * Shared option bank + one dropdown per item. Covers matching headings
   * (i–xi), matching sentence endings (A–G), and listening word banks.
   */
  z.object({
    ...GroupBase,
    type: z.literal("matching"),
    /** Bank entries. `key` is what goes in the answer file. */
    options: z
      .array(z.object({ key: z.string().min(1), text: z.string() }))
      .min(2),
    optionsTitle: z.string().optional(),
    /** Worked examples shown but not answerable, e.g. "Paragraph F — vii". */
    examples: z.array(z.object({ prompt: z.string(), key: z.string() })).optional(),
    questions: z.array(QuestionRef.extend({ prompt: z.string() })).min(1),
  }),
]);
export type Group = z.infer<typeof GroupSchema>;
export type GroupType = Group["type"];

const PassageSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  paragraphs: z
    .array(z.object({ label: z.string().optional(), text: z.string() }))
    .min(1),
});
export type Passage = z.infer<typeof PassageSchema>;

const PartSchema = z.object({
  part: z.number().int().min(1),
  heading: z.string().optional(),
  instructions: z.string().optional(),
  /** Reading only. */
  passage: PassageSchema.optional(),
  groups: z.array(GroupSchema).min(1),
});
export type Part = z.infer<typeof PartSchema>;

export const TestSchema = z.object({
  formatVersion: z.literal(1),
  type: z.enum(TEST_TYPES),
  title: z.string().min(1),
  /** Total test time. Listening 2040 (34 min), Academic Reading 3600 (60 min). */
  durationSeconds: z.number().int().min(10).max(14400),
  /** Shown by Options → Test instructions. */
  instructions: z.string().optional(),
  /**
   * Listening only. Played back to back in array order with no gap, and with
   * no pause or seek control — exactly like the real test.
   */
  audio: z
    .array(z.object({ part: z.number().int().min(1), url: z.string().min(1) }))
    .optional(),
  parts: z.array(PartSchema).min(1),
});
export type Test = z.infer<typeof TestSchema>;

/** A single accepted answer, or a list of alternatives (any one is correct). */
const AnswerValue = z.union([z.string(), z.array(z.string()).min(1)]);

export const AnswerKeySchema = z.object({
  formatVersion: z.literal(1),
  title: z.string().optional(),
  answers: z.record(z.string().regex(/^\d+$/), AnswerValue),
});
export type AnswerKey = z.infer<typeof AnswerKeySchema>;

/* ---------------------------------------------------------------------------
 * Validation helpers
 * ------------------------------------------------------------------------- */

export type ValidationIssue = { level: "error" | "warning"; message: string };

/** Every question number a group is responsible for, in ascending order. */
export function groupQuestionNumbers(group: Group): number[] {
  if (group.type === "mcq-multi") {
    const [from, to] = group.range;
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  return group.questions.map((q) => q.n);
}

export function testQuestionNumbers(test: Test): number[] {
  return test.parts
    .flatMap((p) => p.groups.flatMap(groupQuestionNumbers))
    .sort((a, b) => a - b);
}

/** Formats a Zod issue path as `parts[0] → groups[1] → questions[2].options`. */
function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) return "(root)";
  return path
    .map((seg) => (typeof seg === "number" ? `[${seg}]` : String(seg)))
    .join(".")
    .replace(/\.\[/g, "[");
}

export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    level: "error" as const,
    message: `${formatPath(issue.path)}: ${issue.message}`,
  }));
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: formatZodIssues(result.error) };
}

export function parseTest(raw: unknown): ParseResult<Test> {
  return parseWith(TestSchema, raw);
}

export function parseAnswerKey(raw: unknown): ParseResult<AnswerKey> {
  return parseWith(AnswerKeySchema, raw);
}

export function parseJson(text: string): ParseResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return {
      ok: false,
      issues: [{ level: "error", message: `Not valid JSON — ${(e as Error).message}` }],
    };
  }
}

/**
 * Checks a questions file on its own: number sequence, per-type shape rules,
 * and that every `{{n}}` placeholder in a body maps to a declared question.
 */
export function validateTestInternals(test: Test): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<number, number>();

  for (const part of test.parts) {
    for (const group of part.groups) {
      const numbers = groupQuestionNumbers(group);

      for (const n of numbers) seen.set(n, (seen.get(n) ?? 0) + 1);

      if (group.type === "mcq-multi") {
        const [from, to] = group.range;
        if (to < from) {
          issues.push({
            level: "error",
            message: `Part ${part.part}: mcq-multi range [${from}, ${to}] is backwards.`,
          });
        } else if (to - from + 1 !== group.pick) {
          issues.push({
            level: "error",
            message:
              `Part ${part.part}: mcq-multi asks for ${group.pick} answers but its range ` +
              `${from}–${to} spans ${to - from + 1} question numbers. These must match.`,
          });
        }
        if (group.pick > group.options.length) {
          issues.push({
            level: "error",
            message: `Part ${part.part}: mcq-multi picks ${group.pick} of only ${group.options.length} options.`,
          });
        }
      }

      if (group.type === "matching") {
        const keys = new Set<string>();
        for (const opt of group.options) {
          if (keys.has(opt.key)) {
            issues.push({
              level: "error",
              message: `Part ${part.part}: matching option key "${opt.key}" is duplicated.`,
            });
          }
          keys.add(opt.key);
        }
      }

      // Placeholders in the body must resolve to questions this group owns.
      if (group.body) {
        const owned = new Set(numbers);
        for (const n of placeholdersIn(group.body)) {
          if (!owned.has(n)) {
            issues.push({
              level: "error",
              message:
                `Part ${part.part}: body contains {{${n}}} but the group does not declare ` +
                `question ${n}. Add it to "questions".`,
            });
          }
        }
      }

      // A gap question needs either its own prompt or a placeholder in the body.
      if (group.type === "gap") {
        const inBody = group.body ? new Set(placeholdersIn(group.body)) : new Set<number>();
        for (const q of group.questions) {
          if (!q.prompt && !inBody.has(q.n)) {
            issues.push({
              level: "error",
              message:
                `Question ${q.n} is a gap with no "prompt" and no {{${q.n}}} placeholder ` +
                `in the group body — it would render nothing.`,
            });
          }
        }
      }
    }
  }

  const numbers = [...seen.keys()].sort((a, b) => a - b);
  for (const [n, count] of seen) {
    if (count > 1) {
      issues.push({
        level: "error",
        message: `Question ${n} is declared ${count} times.`,
      });
    }
  }

  // Gaps in the sequence are usually a transcription slip, not a design choice.
  for (let i = 1; i < numbers.length; i++) {
    const gap = numbers[i] - numbers[i - 1];
    if (gap > 1) {
      issues.push({
        level: "warning",
        message: `Question numbers jump from ${numbers[i - 1]} to ${numbers[i]}.`,
      });
    }
  }
  if (numbers.length > 0 && numbers[0] !== 1) {
    issues.push({
      level: "warning",
      message: `Questions start at ${numbers[0]} rather than 1.`,
    });
  }

  if (test.type === "listening") {
    if (!test.audio || test.audio.length === 0) {
      issues.push({
        level: "error",
        message: `Listening tests need at least one entry in "audio".`,
      });
    }
  } else if (test.audio && test.audio.length > 0) {
    issues.push({
      level: "warning",
      message: `Reading tests ignore "audio" — this entry will not be played.`,
    });
  }

  for (const part of test.parts) {
    if (test.type === "reading" && !part.passage) {
      issues.push({
        level: "error",
        message: `Reading part ${part.part} has no "passage".`,
      });
    }
  }

  return issues;
}

/** Cross-checks the answer key against the questions file. */
export function validateAgainstAnswers(test: Test, key: AnswerKey): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const numbers = testQuestionNumbers(test);
  const answered = new Set(Object.keys(key.answers).map(Number));

  for (const n of numbers) {
    if (!answered.has(n)) {
      issues.push({
        level: "warning",
        message: `No answer supplied for question ${n} — it will be marked incorrect.`,
      });
    }
  }
  for (const n of answered) {
    if (!numbers.includes(n)) {
      issues.push({
        level: "warning",
        message: `Answer key has question ${n}, which the questions file does not define.`,
      });
    }
  }

  // Letter answers should match an option that actually exists.
  for (const part of test.parts) {
    for (const group of part.groups) {
      if (group.type !== "matching") continue;
      const keys = new Set(group.options.map((o) => o.key.toLowerCase()));
      for (const q of group.questions) {
        const value = key.answers[String(q.n)];
        if (value === undefined) continue;
        const candidates = Array.isArray(value) ? value : [value];
        if (!candidates.some((c) => keys.has(c.trim().toLowerCase()))) {
          issues.push({
            level: "warning",
            message:
              `Question ${q.n} expects one of the matching keys ` +
              `(${group.options.map((o) => o.key).join(", ")}) but the key says ` +
              `"${candidates.join(" / ")}".`,
          });
        }
      }
    }
  }

  return issues;
}

/** All `{{n}}` placeholders appearing anywhere in a body block. */
export function placeholdersIn(body: Body): number[] {
  const strings: string[] =
    body.kind === "text"
      ? body.lines
      : body.kind === "list"
        ? body.items
        : body.kind === "notes"
          ? body.items.map((i) => i.text)
          : [...body.headers, ...body.rows.flat()];

  const found: number[] = [];
  for (const s of strings) {
    for (const m of s.matchAll(/\{\{(\d+)\}\}/g)) found.push(Number(m[1]));
  }
  return found;
}

/* ---------------------------------------------------------------------------
 * Writing and Speaking.
 *
 * Neither is auto-marked, so each is a single `questions.json` with no answer
 * key. See docs/FORMAT.md.
 * ------------------------------------------------------------------------- */

export const WritingTaskSchema = z.object({
  task: z.number().int().min(1).max(2),
  /** "You should spend about N minutes on this task." */
  minutes: z.number().int().min(1).max(120),
  /** "Write at least N words." */
  minWords: z.number().int().min(1).max(1000),
  /** A line above the boxed prompt, e.g. "Write about the following topic:". */
  lead: z.string().optional(),
  /** The boxed prompt, one entry per paragraph. */
  prompt: z.array(z.string().min(1)).min(1),
  /** Lines below the box, e.g. "Give reasons for your answer…". */
  after: z.array(z.string()).optional(),
  /** Task 1 chart, plan or diagram. A relative `src` resolves next to the file. */
  image: z.object({ src: z.string().min(1), alt: z.string().min(1) }).optional(),
});
export type WritingTask = z.infer<typeof WritingTaskSchema>;

export const WritingTestSchema = z.object({
  formatVersion: z.literal(1),
  type: z.literal("writing"),
  title: z.string().min(1),
  /** Academic Writing is 3600 (60 minutes) for both tasks together. */
  durationSeconds: z.number().int().min(10).max(14400),
  instructions: z.string().optional(),
  tasks: z.array(WritingTaskSchema).min(1).max(2),
});
export type WritingTest = z.infer<typeof WritingTestSchema>;

const SpeakingTopicSchema = z.object({
  title: z.string().min(1),
  questions: z.array(z.string().min(1)).min(1),
});
export type SpeakingTopic = z.infer<typeof SpeakingTopicSchema>;

export const SpeakingTestSchema = z.object({
  formatVersion: z.literal(1),
  type: z.literal("speaking"),
  title: z.string().min(1),
  instructions: z.string().optional(),
  /** Introduction and interview: short questions on familiar topics. */
  part1: z.object({ topics: z.array(SpeakingTopicSchema).min(1) }),
  /** The long turn, from a cue card. */
  part2: z.object({
    /** "Describe a time when…" */
    topic: z.string().min(1),
    /** The "You should say:" bullet points. */
    points: z.array(z.string().min(1)).min(1),
    /** "and explain…" */
    closing: z.string().optional(),
    prepSeconds: z.number().int().min(0).max(300).default(60),
    speakSeconds: z.number().int().min(10).max(600).default(120),
    /** Optional one or two questions the examiner asks after the long turn. */
    followUp: z.array(z.string().min(1)).optional(),
  }),
  /** Two-way discussion on themes linked to Part 2. */
  part3: z.object({ topics: z.array(SpeakingTopicSchema).min(1) }),
});
export type SpeakingTest = z.infer<typeof SpeakingTestSchema>;

export function parseWritingTest(raw: unknown): ParseResult<WritingTest> {
  const parsed = parseWith(WritingTestSchema, raw);
  if (!parsed.ok) return parsed;
  const numbers = parsed.value.tasks.map((t) => t.task);
  if (new Set(numbers).size !== numbers.length) {
    return { ok: false, issues: [{ level: "error", message: "tasks: task numbers must be unique." }] };
  }
  return parsed;
}

export function parseSpeakingTest(raw: unknown): ParseResult<SpeakingTest> {
  return parseWith(SpeakingTestSchema, raw);
}

/** Words as the IELTS computer test counts them: anything between spaces. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}
