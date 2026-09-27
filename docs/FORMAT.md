# Test file format (v1)

Every test is **two JSON files**:

| File | Contains |
| --- | --- |
| `<name>.questions.json` | The test itself — passages, questions, timing, audio |
| `<name>.answers.json` | The answer key, keyed by question number |

Both are validated when you load them. Errors block the start; warnings don't.

Two worked examples live in [`public/samples/`](../public/samples):

- `demo-reading.*` — a complete, runnable 12-question Reading test exercising every group type
- `demo-listening.*` — a Listening skeleton showing the `audio` array and form/table completion
  (replace the placeholder URLs with your own recordings before running it)

Copy whichever is closer to what you're transcribing and edit it.

## Test library (`contents/`)

Tests placed in the `contents/` folder appear on the home page automatically — no file picking.
Each folder is one test, and each sub-folder one section of it:

```
contents/
  cambridge-18-test-1/
    test.json                 optional — { "title": "…", "description": "…" }
    listening/
      questions.json
      answers.json
      part1.mp3               referenced as "url": "part1.mp3"
    reading/
      questions.json
      answers.json
    writing/                  shown as "coming soon" for now
    speaking/                 shown as "coming soon" for now
```

- A section is playable once it has both `questions.json` and `answers.json`, in the format below.
- A relative audio `url` resolves against the section folder, so recordings can sit beside the
  questions. Absolute URLs work as before.
- Without `test.json`, the title is taken from the folder name.
- Folders starting with `.` or `_` are ignored — handy for drafts.

Under `npm run dev` new folders show up on refresh; the deployed site picks them up at build time.

---

## Questions file

```jsonc
{
  "formatVersion": 1,
  "type": "listening",              // "listening" | "reading"
  "title": "Demo Listening — Format Template",
  "durationSeconds": 2040,          // 2040 = 34 min listening, 3600 = 60 min reading
  "instructions": "…",              // optional — shown by Options → Test Instructions
  "audio": [                        // listening only
    { "part": 1, "url": "https://…/part1.mp3" },
    { "part": 2, "url": "https://…/part2.mp3" }
  ],
  "parts": [ … ]
}
```

### `audio` (Listening only)

Tracks play **back to back in array order**, with no gap and with **no pause, seek or replay** — only a volume control, exactly like the real test. If your source is one continuous 30-minute recording, give a single entry; the four `part` tabs still work independently of the audio.

Every URL is fetched and buffered on the setup page before **Start test** unlocks, so a broken link can't strand you mid-test. Local files aren't supported — use a URL (a `file://` path or a local static server both work).

### `parts`

```jsonc
{
  "part": 1,
  "heading": "Part 1",                       // optional
  "instructions": "Listen and answer questions 1–10.",   // optional, shown in the box at the top
  "passage": { … },                          // reading only — required for reading
  "groups": [ … ]
}
```

### `passage` (Reading only)

```jsonc
{
  "title": "The Lighthouse Keepers",
  "subtitle": "For three centuries a scattered profession kept the coastlines lit.",
  "paragraphs": [
    { "text": "The job of the lighthouse keeper was, for most of its history…" },
    { "label": "A", "text": "The job of the lighthouse keeper was…" }   // label only for A–F passages
  ]
}
```

Include `label` only when the questions refer to paragraphs by letter (matching headings). Highlighting and notes work across the whole passage, including across paragraph boundaries.

---

## Question groups

Six group types cover every IELTS question format. Each group carries its own `instructions`, and any group may add an `intro` (a line of bold text above the questions) or a `body` (see [Bodies](#bodies)).

### `mcq` — multiple choice, one answer

Options are auto-lettered **A, B, C, D…** in array order. The answer key uses the letter.

```jsonc
{
  "type": "mcq",
  "instructions": "Choose the correct letter, A, B or C.",
  "questions": [
    {
      "n": 1,
      "prompt": "Where does the caller want to travel?",
      "options": ["the coast", "the mountains", "the lakes"]
    }
  ]
}
```

### `mcq-multi` — "Choose TWO letters, A–E"

One prompt, one option bank, several answers. `range` is the **inclusive span of question numbers** the group consumes, and its length must equal `pick`.

```jsonc
{
  "type": "mcq-multi",
  "instructions": "Choose TWO letters, A–E.",
  "prompt": "Which TWO reasons does the writer give for retaining human keepers?",
  "options": ["They cost less", "They can supply weather reports", "…"],
  "pick": 2,
  "range": [11, 12]
}
```

Graded as a **set**: order doesn't matter, and it's all-or-nothing across the range. Both numbers light up in the nav bar together once you've picked enough options.

### `gap` — short written answers

Two shapes. Either give each question its own `prompt`:

```jsonc
{
  "type": "gap",
  "instructions": "Complete the sentences below.",
  "limit": "NO MORE THAN THREE WORDS",
  "questions": [
    { "n": 9, "prompt": "The relief boat was delayed by __________" }
  ]
}
```

…or place `{{n}}` placeholders inside a `body`, and list the numbers with no prompt:

```jsonc
{
  "type": "gap",
  "instructions": "Complete the table below.",
  "limit": "NO MORE THAN THREE WORDS OR A NUMBER",
  "body": {
    "kind": "table",
    "headers": ["Field", "Detail"],
    "rows": [
      ["Surname", "{{3}}"],
      ["Reference number", "{{4}}"]
    ]
  },
  "questions": [{ "n": 3 }, { "n": 4 }]
}
```

`limit` is free text, rendered as "Write &lt;limit&gt; for each answer". It is **not enforced** — IELTS penalises over-length answers by marking them wrong, and your answer key already encodes what's acceptable.

### `tf-ng` and `yn-ng`

No options needed — the three buttons are fixed. Use `tf-ng` for TRUE / FALSE / NOT GIVEN (facts) and `yn-ng` for YES / NO / NOT GIVEN (the writer's claims).

```jsonc
{
  "type": "tf-ng",
  "instructions": "Do the following statements agree with the information given?\n\nTRUE if…",
  "questions": [
    { "n": 4, "prompt": "Rock stations were staffed by three keepers after an earlier death." }
  ]
}
```

Answer key values are the words: `"TRUE"`, `"FALSE"`, `"NOT GIVEN"`, `"YES"`, `"NO"`.

### `matching` — headings, sentence endings, word banks

One shared option bank plus a dropdown per question. This single type covers matching headings (`i`–`xi`), matching sentence endings (`A`–`G`), and Listening word banks — the only difference is what you put in `key`.

```jsonc
{
  "type": "matching",
  "instructions": "Choose the correct heading for paragraphs B, C and E.",
  "optionsTitle": "List of Headings",
  "options": [
    { "key": "i",  "text": "A debate that remains open" },
    { "key": "iv", "text": "Why three was the required number" }
  ],
  "examples": [{ "prompt": "Paragraph A", "key": "vi" }],   // shown, not answerable
  "questions": [
    { "n": 1, "prompt": "Paragraph B" },
    { "n": 2, "prompt": "Paragraph C" }
  ]
}
```

`key` is what goes in the answer file and what the dropdown shows. For a word bank, make the key the word itself (`{ "key": "Monday", "text": "Monday" }`) so the key file reads naturally.

---

## Bodies

Any group may carry a `body` — a block of content rendered above the questions, in which `{{n}}` becomes an inline answer box for question `n`. This is how notes, tables and flow-chart completion work without needing their own group types.

Four kinds:

```jsonc
{ "kind": "text",  "lines": ["Paragraph one with a {{7}} gap.", "Paragraph two."] }

{ "kind": "list",  "ordered": false, "items": ["First point {{8}}", "Second point"] }

{ "kind": "notes",
  "heading": "Decline of the profession",
  "items": [
    { "text": "Each technological change removed a task:",     "indent": 0 },
    { "text": "{{7}} mechanisms replaced by electric motors",  "indent": 1 }
  ] }

{ "kind": "table",
  "headers": ["Field", "Detail"],
  "rows": [["Surname", "{{3}}"]] }
```

`indent` is 0–3; anything above 0 renders as a nested bullet. A `\n` inside any string becomes a line break — useful inside a table cell.

Every `{{n}}` must appear in the group's `questions` list, or loading fails with a clear error.

---

## Answers file

```jsonc
{
  "formatVersion": 1,
  "title": "Demo Listening — Format Template",   // optional
  "answers": {
    "1": "B",
    "3": ["Whitfield", "Whitfeld"],
    "7": "Clockwork / clockwork",
    "5": "A",
    "6": "C"
  }
}
```

Keys are question numbers as strings. A value is either one accepted answer or an array of alternatives — **any one** of which is correct.

`mcq-multi` groups are keyed **per question number**: `"5": "A"` and `"6": "C"` together mean "the accepted set is {A, C}". You don't put both letters under one key.

### How answers are matched

Checked in this order — an exact match is always preferred:

1. **Exact**, after collapsing runs of whitespace.
2. **Lenient**, which additionally ignores letter case, a trailing `.,;:!?`, curly vs straight quotes, and dash variants. Answers accepted this way are marked "(accepted)" in the review so you can see where you were saved by leniency.
3. **Leading article**, so `coast` and `the coast` both pass regardless of which the key uses.

A **spaced slash** separates alternatives inside a single string, so `"verandas / verandahs"` behaves the same as `["verandas", "verandahs"]`. The space is required — `km/h` stays one answer.

An answer number that's missing from the key is reported as a warning on the setup page and marked incorrect. That's deliberate: it stays visible rather than silently vanishing.

---

## Band scores

Raw score converts to a band using the official tables — the Listening table for `"type": "listening"`, the Academic Reading table for `"type": "reading"`. If a file has some number of questions other than 40, the raw score is scaled to 40 first and the results page says so.

---

## Checklist for a new test

- [ ] `formatVersion: 1` in both files
- [ ] `type` matches the page you load it on
- [ ] Question numbers run consecutively with no gaps or duplicates (1–40 for a full paper)
- [ ] Every question number has an entry in `answers`
- [ ] Every `{{n}}` appears in its group's `questions`
- [ ] `mcq-multi`: `range` length equals `pick`
- [ ] `matching`: answer-key values match an option `key`
- [ ] Listening: at least one `audio` entry, and every URL loads
- [ ] Reading: every part has a `passage`
