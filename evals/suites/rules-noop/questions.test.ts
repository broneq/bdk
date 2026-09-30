import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../../harness/paths.ts";
import { MIGRATION_REPORT, measuredIds, readBullets } from "./bullets.ts";
import { readQuestions, sharedRun } from "./questions.ts";

describe("sharedRun", () => {
  it("finds a six-word run ignoring case, markup and punctuation", () => {
    expect(
      sharedRun(
        "Why must we **never build interpreted strings** by concatenation?",
        "Never build interpreted strings by concatenating input.",
      ),
    ).toBeNull();
    expect(
      sharedRun(
        "Should you Never build `interpreted` strings by concatenating, ever?",
        "**Injection.** Never build interpreted strings by concatenating input.",
      ),
    ).toBe("never build interpreted strings by concatenating");
  });
});

describe("questions.yaml", () => {
  const bullets = readBullets();
  const questions = readQuestions();

  it("has exactly one question per measured bullet, the pack's among them", () => {
    const measured = measuredIds(readFileSync(join(REPO_ROOT, MIGRATION_REPORT), "utf8"));
    expect(questions.map((entry) => entry.bullet).sort()).toEqual([...measured].sort());
    const asked = new Set(questions.map((entry) => entry.bullet));
    expect(bullets.filter((bullet) => !asked.has(bullet.id))).toEqual([]);
  });

  it("never quotes its bullet: no six-word run in common", () => {
    const quoting = questions.flatMap((entry) => {
      const bullet = bullets.find((candidate) => candidate.id === entry.bullet);
      const run = bullet === undefined ? null : sharedRun(entry.question, bullet.text);
      return run === null ? [] : [`${entry.bullet}: ${run}`];
    });
    expect(quoting).toEqual([]);
  });
});
