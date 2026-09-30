import { describe, expect, it } from "vitest";

import { readBullets } from "./bullets.ts";
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

  it("has exactly one question per rule bullet", () => {
    expect(questions.map((entry) => entry.bullet).sort()).toEqual(
      bullets.map((bullet) => bullet.id).sort(),
    );
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
