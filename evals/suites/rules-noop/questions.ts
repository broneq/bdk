// The M1 questions (design D-8): `questions.yaml`, one per rule bullet.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

export interface Question {
  readonly bullet: string;
  readonly question: string;
}

const QUESTIONS_FILE = fileURLToPath(new URL("./questions.yaml", import.meta.url));

export function readQuestions(file = QUESTIONS_FILE): Question[] {
  return parse(readFileSync(file, "utf8")) as Question[];
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[*`_]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
}

/** The first run of `length` consecutive words the question shares with the bullet, or null. */
export function sharedRun(question: string, bullet: string, length = 6): string | null {
  const bulletWords = words(bullet);
  const runs = new Set<string>();
  for (let index = 0; index + length <= bulletWords.length; index++) {
    runs.add(bulletWords.slice(index, index + length).join(" "));
  }
  const questionWords = words(question);
  for (let index = 0; index + length <= questionWords.length; index++) {
    const run = questionWords.slice(index, index + length).join(" ");
    if (runs.has(run)) return run;
  }
  return null;
}
