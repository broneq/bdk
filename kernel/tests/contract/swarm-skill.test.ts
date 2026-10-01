// `role-contracts`, Swarm skill: the principles the stage skills that
// dispatch roles follow, and the host note they link.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { REPO_ROOT } from "../support/run.ts";

const DIR = join(REPO_ROOT, "skills", "swarm");

function readSkill(): { meta: Record<string, unknown>; body: string } {
  const text = readFileSync(join(DIR, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match?.[1] === undefined) throw new Error("swarm: no frontmatter");
  return { meta: parse(match[1]) as Record<string, unknown>, body: text.slice(match[0].length) };
}

function sentences(body: string): string[] {
  return body
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s/)
    .map((sentence) => sentence.trim());
}

describe("swarm skill", () => {
  it("has the swarm skill shape", () => {
    const { meta, body } = readSkill();
    expect(meta).toMatchObject({ name: "swarm", "user-invocable": false });
    expect(body).toContain("ctx skill swarm");
    expect(body).toContain("`execution.concurrency`");
    expect(body).toContain("`bdk log list --since-ticket-start <ticket>`");
    expect(body).toMatch(/`Files:` are disjoint/);
    expect(body).toMatch(/package path/);
    expect(body).toMatch(/`SendMessage` to `main`/);
    expect(body).toContain("](references/hosts/claude-code.md)");
    expect(body).toContain("`bdk agents wait <own id>`");
    expect(body).toMatch(/in the background/);
    expect(existsSync(join(DIR, "references", "hosts", "claude-code.md"))).toBe(true);
  });

  it("runs the ticket's steps under the same ticket, then closes it", () => {
    const { body } = readSkill();
    expect(body).toMatch(/`steps`/);
    expect(body).toContain("bdk attempt close <ticket>");
  });

  it("holds no flat-swarm sentence", () => {
    const flat = sentences(readSkill().body).filter(
      (sentence) => /\bflat\b/i.test(sentence) || /no adapter carries/i.test(sentence),
    );
    expect(flat).toEqual([]);
  });

  it("resumes an agent once and closes the ticket fail after a second failure", () => {
    const resume = sentences(readSkill().body).filter((sentence) => /resume/i.test(sentence));
    expect(
      resume.some(
        (sentence) =>
          sentence.includes("once") &&
          sentence.includes("refusal") &&
          sentence.includes("`suspect`"),
      ),
    ).toBe(true);
    expect(
      sentences(readSkill().body).some(
        (sentence) => sentence.includes("second") && sentence.includes("`fail`"),
      ),
    ).toBe(true);
  });
});
