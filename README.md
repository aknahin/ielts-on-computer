<div align="center">

# IELTS on Computer — Practice

**A faithful practice harness for the computer-delivered IELTS Listening and Academic Reading tests.**

Bring your own question papers as JSON. Sit them under exam conditions. Get a band score.

**[Try it live →](https://ielts-on-computer.netlify.app/)**

[Getting started](#getting-started) · [File format](docs/FORMAT.md) · [What it reproduces](#what-it-reproduces) · [Architecture](#architecture)

![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-087ea4?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)
[![Live demo](https://img.shields.io/badge/live%20demo-ielts--on--computer.netlify.app-38bdf8)](https://ielts-on-computer.netlify.app/)

</div>

---

## Why this exists

Most IELTS practice material is a PDF. The real test is not a PDF — it is a specific piece of
software with a countdown timer you cannot pause, a navigation bar that tracks what you have
answered, text you highlight by dragging, and audio that plays exactly once and then is gone.
Practising the questions without practising the interface leaves a gap on test day.

This project closes that gap. The interface is modelled directly on the official
[*IELTS on computer — Quick Guide*](https://www.youtube.com/watch?v=4_dCncUPBO4) walkthrough,
feature by feature, down to the three contrast modes and the moment the screen changes colour with
one minute remaining.

Everything runs locally in your browser. There is no backend, no account, and nothing is uploaded
anywhere — your question files are read with the File API and never leave the machine.

---

## Getting started

The app is deployed at **<https://ielts-on-computer.netlify.app/>** — nothing to install, and your
files still never leave your browser. To run it yourself:

**Requirements:** Node.js 20 or later.

```bash
git clone https://github.com/aknahin/ielts-on-computer.git
cd ielts-on-computer
npm install
npm run dev
```

Open <http://localhost:3000>.

### Taking a test

1. Choose **Listening** or **Reading**.
2. Load a questions file and an answers file — drag and drop, browse, or paste the JSON. Both are
   validated immediately, with errors reported by path (`parts[1].groups[0].questions[3]: …`).
   For Listening, every recording is fetched and buffered before the test can begin.
3. Press **Start test**. The app enters fullscreen, the clock starts, and Listening audio begins.
4. When the time runs out — or when you submit early — you get a band score, a per-part breakdown,
   and a question-by-question review.

Try it immediately with the bundled demo — the setup screen offers to load it for you, or grab the
files directly:

```
public/samples/demo-reading.questions.json
public/samples/demo-reading.answers.json
```

A complete 12-question Reading test that exercises every supported question type.

---

## What it reproduces

The interface follows the official [*IELTS on computer — Quick Guide*](https://www.youtube.com/watch?v=4_dCncUPBO4)
walkthrough feature by feature: the countdown timer fixed to a wall-clock deadline so it survives
tab throttling and sleep, part instructions in their bordered box, the navigation bar listing every
question number grouped by part with arrows between them, the underline that appears beneath a
number once it is answered, flagging and jumping back to flagged questions, the options menu
available throughout, all three contrast modes (black on white, white on black, yellow on black)
and three text sizes, the volume slider that is the only audio control exposed during a Listening
test, test instructions reachable at any point, drag-to-select highlighting with click-to-delete,
notes anchored to the selected text that autosave and reopen and take two steps to delete, the
top band changing colour with one minute left, and the test submitting itself when the clock
reaches zero. Listening audio plays each part back to back with no gap and offers no pause, seek or
replay — matching the real exam, where you hear each recording once.

### Two deliberate departures

Both exist because this is a practice tool, not an exam:

- **Submit test** in the options menu, so you can end a run early. The real exam has no such control.
- **Replayable audio on the results page**, so you can re-listen to what you missed. During the
  test it is not replayable.

---

## Test files

A test is two JSON files: the paper and the answer key.

```jsonc
// demo-reading.questions.json
{
  "formatVersion": 1,
  "type": "reading",
  "title": "Demo Reading — The Lighthouse Keepers",
  "durationSeconds": 900,
  "parts": [{
    "part": 1,
    "passage": { "title": "The Lighthouse Keepers", "paragraphs": [ … ] },
    "groups": [{
      "type": "tf-ng",
      "instructions": "Do the following statements agree with the information given?",
      "questions": [{ "n": 4, "prompt": "Rock stations were staffed by three keepers…" }]
    }]
  }]
}
```

```jsonc
// demo-reading.answers.json
{
  "formatVersion": 1,
  "answers": {
    "4": "TRUE",
    "7": "Clockwork",
    "12": ["verandas", "verandahs"]   // any one accepted
  }
}
```

Six group types cover every IELTS question format:

| Type | Used for |
| :-- | :-- |
| `mcq` | Multiple choice, one answer |
| `mcq-multi` | "Choose TWO letters, A–E" — graded as a set across a number range |
| `gap` | Sentence, note, table, form and flow-chart completion |
| `tf-ng` | TRUE / FALSE / NOT GIVEN |
| `yn-ng` | YES / NO / NOT GIVEN |
| `matching` | Matching headings, sentence endings, and word banks |

Notes, tables and flow charts are **not** separate types. Any group may carry a `body` whose
`{{7}}` placeholders become inline answer boxes, which keeps one mechanism behind every layout
IELTS uses.

📖 **[Read the full format specification →](docs/FORMAT.md)**

### Answer matching

Marking is deliberately forgiving in the ways IELTS is, and strict in the ways it is not:

- Alternatives via an array, or a spaced slash inside one string (`"verandas / verandahs"`).
  The space matters — `km/h` stays a single answer.
- Case, extra whitespace, trailing punctuation, and curly-versus-straight quotes are ignored.
- A leading article is optional, so `coast` and `the coast` both pass.
- Anything accepted only after normalisation is flagged **(accepted)** in the review, so you can
  see where leniency saved you.

---

## Architecture

Static Next.js App Router pages, entirely client-rendered. No server, no database, no network calls
beyond fetching the audio URLs you supply.

```
app/                    Routes: home, setup/[type], tests/[test]/[section], test, results,
                        writing, speaking
components/
  questions/            One component per group type, plus the {{n}} body renderer
  test/                 Timer, nav bar, options menu, audio runner, passage, notes, split pane
  setup/                Upload, validation display, audio preflight
  results/              Score, per-part breakdown, answer review
  writing/              Writing setup, task/answer screen, review
  speaking/             Speaking setup and mic check, examiner-led screen, recordings review
lib/
  schema.ts             Zod schemas — the single source of truth for the file format
  scoring.ts            Answer normalisation and marking
  bandTables.ts         Official raw-score → band conversion
  words.ts              Passage tokeniser and the annotation model
  store.ts              Zustand session state
  contents.ts           Scans contents/ for the built-in test library
  writingStore.ts       Writing session (essays, word counts)
  speakingStore.ts      Speaking session (in-memory recordings)
  speakingScript.ts     Turns a speaking file into the examiner's step-by-step script
  speech.ts             Examiner voice (speech synthesis) and answer recording
contents/               Ready-made tests: contents/<test>/<section>/questions.json (+ answers.json)
```

Three decisions worth calling out:

**Highlighting is integer ranges, not DOM ranges.** Passage text is tokenised into word spans with
stable global indices, so an annotation is just `{ start, end }`. Rendering becomes pure derived
state — immune to React re-renders, and unaffected when the reader switches contrast or text size
mid-test. The usual approach, mutating DOM `Range` objects, breaks on all three.

**The timer targets a wall-clock deadline** rather than decrementing a counter, so a throttled
background tab or a sleeping laptop cannot buy you extra time.

**Audio is preflighted before the test starts.** Because playback cannot be paused, a recording
that fails to load halfway through Part 3 would be unrecoverable. Every URL must be reachable
before **Start test** unlocks.

### Development

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
npx tsc --noEmit # typecheck
```

### Data and persistence

| What | Where | Lifetime |
| :-- | :-- | :-- |
| Contrast and text size | `localStorage` | Persists across sessions |
| In-progress test | `sessionStorage` | Survives an accidental refresh; cleared on submit |
| Question files | Memory | Loaded fresh each run, never persisted |
| Results | Memory | Lost on navigation — use **Print / save PDF** to keep them |

---

## Roadmap

- [ ] General Training Reading band table
- [ ] Writing and Speaking modules
- [ ] Drag-and-drop for matching questions, as an alternative to the dropdown
- [ ] Import from a local audio file rather than a URL

---

## A note on question papers

No copyrighted test material ships with this repository. The bundled samples are original content
written for this project, and exist to demonstrate the file format.

Cambridge IELTS papers and similar published material are copyrighted by their publishers. Convert
your own copies for personal study if you wish, but please do not redistribute them.

---

## License

[MIT](LICENSE) © Asrafuzzaman Khan Nahin

The IELTS trademark is the property of the British Council, IDP: IELTS Australia and Cambridge
University Press & Assessment. This project is unofficial and unaffiliated.
