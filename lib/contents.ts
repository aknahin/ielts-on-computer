import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * The bundled test library. Every folder under `contents/` is one test, and
 * every sub-folder of it is one section of that test:
 *
 *   contents/<test>/
 *     test.json              optional — { "title": "…", "description": "…" }
 *     reading/questions.json
 *     reading/answers.json
 *     listening/questions.json
 *     listening/answers.json
 *     listening/part1.mp3    audio referenced by a relative "url"
 *     writing/questions.json
 *     writing/task1.png      a Task 1 figure referenced by a relative "src"
 *     speaking/questions.json
 *
 * Everything here runs on the server — at build time for the deployed site,
 * per request under `next dev` — so dropping a folder in is all it takes.
 */

export const CONTENTS_DIR = path.join(process.cwd(), "contents");

export const SECTIONS = ["listening", "reading", "writing", "speaking"] as const;
export type Section = (typeof SECTIONS)[number];

/** Listening and Reading are marked against a key; Writing and Speaking are not. */
export const SCORED = ["listening", "reading"] as const;
export type ScoredSection = (typeof SCORED)[number];

export function isSection(section: string): section is Section {
  return (SECTIONS as readonly string[]).includes(section);
}

export function isScored(section: string): section is ScoredSection {
  return (SCORED as readonly string[]).includes(section);
}

function requiredFiles(section: Section): string[] {
  return isScored(section) ? ["questions.json", "answers.json"] : ["questions.json"];
}

export type LibrarySection = {
  section: Section;
  /** False when the section folder is missing a required file. */
  complete: boolean;
};

export type LibraryTest = {
  slug: string;
  title: string;
  description: string | null;
  sections: LibrarySection[];
};

/** Media a section folder may carry alongside its JSON; served under /contents. */
export const MEDIA_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
  ".flac": "audio/flac",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function subdirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_"))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

/** Folder names are used in URLs, so only plain ones are accepted. */
function isSafeSegment(name: string): boolean {
  return /^[\w.-]+$/.test(name) && name !== "." && name !== "..";
}

async function readMeta(slug: string): Promise<{ title?: string; description?: string }> {
  try {
    const raw = await fs.readFile(path.join(CONTENTS_DIR, slug, "test.json"), "utf8");
    const meta = JSON.parse(raw) as unknown;
    if (meta && typeof meta === "object") {
      const { title, description } = meta as Record<string, unknown>;
      return {
        title: typeof title === "string" ? title : undefined,
        description: typeof description === "string" ? description : undefined,
      };
    }
  } catch {
    /* no test.json, or not valid JSON — fall back to the folder name */
  }
  return {};
}

function titleFromSlug(slug: string): string {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function listTests(): Promise<LibraryTest[]> {
  const tests: LibraryTest[] = [];

  for (const slug of await subdirs(CONTENTS_DIR)) {
    if (!isSafeSegment(slug)) continue;
    const found = new Set(await subdirs(path.join(CONTENTS_DIR, slug)));

    const sections: LibrarySection[] = [];
    for (const section of SECTIONS) {
      if (!found.has(section)) continue;
      const dir = path.join(CONTENTS_DIR, slug, section);
      let complete = true;
      for (const file of requiredFiles(section)) {
        if (!(await exists(path.join(dir, file)))) complete = false;
      }
      sections.push({ section, complete });
    }
    if (sections.length === 0) continue;

    const meta = await readMeta(slug);
    tests.push({
      slug,
      title: meta.title ?? titleFromSlug(slug),
      description: meta.description ?? null,
      sections,
    });
  }

  return tests;
}

export async function getTest(slug: string): Promise<LibraryTest | null> {
  if (!isSafeSegment(slug)) return null;
  return (await listTests()).find((t) => t.slug === slug) ?? null;
}

export type SectionFiles = {
  questions: { text: string; filename: string };
  answers: { text: string; filename: string };
};

/**
 * Reads one section's question and answer files as text, for the setup page
 * to validate exactly as if they had been dropped in.
 *
 * Relative audio URLs are rewritten to point at the section folder, so a
 * listening test can ship its recordings right beside its questions.
 */
export async function readSection(
  slug: string,
  section: ScoredSection,
): Promise<SectionFiles | null> {
  if (!isSafeSegment(slug)) return null;
  const dir = path.join(CONTENTS_DIR, slug, section);

  let questions: string;
  let answers: string;
  try {
    [questions, answers] = await Promise.all([
      fs.readFile(path.join(dir, "questions.json"), "utf8"),
      fs.readFile(path.join(dir, "answers.json"), "utf8"),
    ]);
  } catch {
    return null;
  }

  return {
    questions: {
      text: resolveMedia(questions, `/contents/${slug}/${section}/`),
      filename: `${slug}/${section}/questions.json`,
    },
    answers: { text: answers, filename: `${slug}/${section}/answers.json` },
  };
}

/**
 * Reads a Writing or Speaking `questions.json` as text. There is no answer
 * key; relative image paths are rewritten like audio URLs.
 */
export async function readTaskSection(
  slug: string,
  section: "writing" | "speaking",
): Promise<{ text: string; filename: string } | null> {
  if (!isSafeSegment(slug)) return null;
  try {
    const text = await fs.readFile(path.join(CONTENTS_DIR, slug, section, "questions.json"), "utf8");
    return {
      text: resolveMedia(text, `/contents/${slug}/${section}/`),
      filename: `${slug}/${section}/questions.json`,
    };
  } catch {
    return null;
  }
}

/** Absolute URLs, root-relative paths and data/blob URIs are left alone. */
function isRelativeUrl(url: string): boolean {
  return !/^([a-z][a-z\d+.-]*:|\/)/i.test(url);
}

/** Points relative `audio[].url` and `tasks[].image.src` at the section folder. */
function resolveMedia(text: string, base: string): string {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return text; // left for the setup page to report
  }
  const root = json as { audio?: unknown; tasks?: unknown };
  const resolve = (url: string) =>
    base + url.replace(/^\.\//, "").split("/").map(encodeURIComponent).join("/");

  let changed = false;
  if (Array.isArray(root?.audio)) {
    for (const entry of root.audio) {
      if (entry && typeof entry.url === "string" && isRelativeUrl(entry.url)) {
        entry.url = resolve(entry.url);
        changed = true;
      }
    }
  }
  if (Array.isArray(root?.tasks)) {
    for (const task of root.tasks) {
      const image = task?.image;
      if (image && typeof image.src === "string" && isRelativeUrl(image.src)) {
        image.src = resolve(image.src);
        changed = true;
      }
    }
  }
  return changed ? JSON.stringify(json, null, 2) : text;
}

/** Every media file in the library, as path segments below `contents/`. */
export async function listMedia(): Promise<string[][]> {
  const out: string[][] = [];
  async function walk(dir: string, segments: string[]) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (e.isDirectory()) await walk(path.join(dir, e.name), [...segments, e.name]);
      else if (MEDIA_TYPES[path.extname(e.name).toLowerCase()]) out.push([...segments, e.name]);
    }
  }
  await walk(CONTENTS_DIR, []);
  return out;
}

/** Resolves a /contents/… request to a media file, refusing anything outside the library. */
export function mediaPath(segments: string[]): { file: string; type: string } | null {
  const file = path.resolve(CONTENTS_DIR, ...segments);
  if (!file.startsWith(CONTENTS_DIR + path.sep)) return null;
  const type = MEDIA_TYPES[path.extname(file).toLowerCase()];
  return type ? { file, type } : null;
}
