import type { SpeakingTest } from "./schema";

/**
 * The Speaking test flattened into the order an examiner runs it. Each step
 * is one thing the examiner says, optionally followed by the candidate's turn.
 */
export type Step =
  /** The examiner speaks; the candidate just listens. */
  | { kind: "say"; id: string; part: 1 | 2 | 3; text: string }
  /** The examiner asks; the candidate answers while being recorded. */
  | {
      kind: "question";
      id: string;
      part: 1 | 2 | 3;
      topic: string | null;
      /** What is shown on screen. */
      text: string;
      /** What the examiner says — may add "Let's talk about…" first. */
      spoken: string;
    }
  /** Part 2: the cue card and one minute to prepare. */
  | { kind: "prepare"; id: string; part: 2 }
  /** Part 2: the long turn. */
  | { kind: "longTurn"; id: string; part: 2 }
  | { kind: "end"; id: string; part: 3 };

export function buildScript(test: SpeakingTest): Step[] {
  const steps: Step[] = [];

  steps.push({
    kind: "say",
    id: "p1-intro",
    part: 1,
    text: "Good morning. This is the Speaking test. In this first part, I'd like to ask you some questions about yourself.",
  });
  test.part1.topics.forEach((topic, t) => {
    topic.questions.forEach((q, i) => {
      steps.push({
        kind: "question",
        id: `p1-t${t + 1}-q${i + 1}`,
        part: 1,
        topic: topic.title,
        text: q,
        spoken: i === 0 ? `Let's talk about ${lowerFirst(topic.title)}. ${q}` : q,
      });
    });
  });

  const { part2 } = test;
  steps.push({
    kind: "say",
    id: "p2-intro",
    part: 2,
    text: `Now, I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. Before you talk, you'll have ${spokenSeconds(part2.prepSeconds)} to think about what you're going to say. You can make some notes if you wish. Here is your topic.`,
  });
  steps.push({ kind: "prepare", id: "p2-prepare", part: 2 });
  steps.push({
    kind: "say",
    id: "p2-go",
    part: 2,
    text: "All right? Remember, you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?",
  });
  steps.push({ kind: "longTurn", id: "p2-talk", part: 2 });
  part2.followUp?.forEach((q, i) => {
    steps.push({ kind: "question", id: `p2-f${i + 1}`, part: 2, topic: null, text: q, spoken: q });
  });

  steps.push({
    kind: "say",
    id: "p3-intro",
    part: 3,
    text: "Thank you. We've been talking about that topic, and now I'd like to discuss with you one or two more general questions related to it.",
  });
  test.part3.topics.forEach((topic, t) => {
    topic.questions.forEach((q, i) => {
      steps.push({
        kind: "question",
        id: `p3-t${t + 1}-q${i + 1}`,
        part: 3,
        topic: topic.title,
        text: q,
        spoken: i === 0 ? `Let's consider ${lowerFirst(topic.title)}. ${q}` : q,
      });
    });
  });

  steps.push({ kind: "end", id: "end", part: 3 });
  return steps;
}

function lowerFirst(s: string): string {
  // Keep acronyms and proper nouns ("TV", "London") as they are.
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

function spokenSeconds(s: number): string {
  if (s === 60) return "one minute";
  if (s % 60 === 0) return `${s / 60} minutes`;
  return `${s} seconds`;
}
