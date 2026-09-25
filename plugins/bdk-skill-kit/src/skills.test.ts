// The kit's own skills: `skill-authoring` must explain every generic rule, and
// cite nothing else, so guidance and checker cannot drift apart.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { genericRules } from "./rules/index.ts";

const skills = join(import.meta.dirname, "..", "skills");
const authoring = join(skills, "skill-authoring");

/** A citation is a parenthesised list of backticked IDs: (`a`) or (`a`, `b`). */
const CITATION = /\((`[a-z][a-z0-9-]*`(?:,\s*`[a-z][a-z0-9-]*`)*)\)/g;

function markdown(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(join(dir, f), "utf8"));
}

function cited(texts: string[]): string[] {
  const ids = texts.flatMap((text) =>
    [...text.matchAll(CITATION)].flatMap((m) =>
      (m[1] ?? "").split(/,\s*/).map((id) => id.slice(1, -1)),
    ),
  );
  return [...new Set(ids)].sort();
}

const lines = (file: string) => readFileSync(file, "utf8").trimEnd().split("\n").length;

describe("kit skills", () => {
  it("skill-authoring cites exactly the generic rule IDs", () => {
    expect(cited(markdown(authoring))).toEqual(genericRules.map((r) => r.id).sort());
  });

  it("finds citations in both forms", () => {
    expect(
      cited(["Keep it short (`line-limit`).", "Link it (`references`, `unused-files`)."]),
    ).toEqual(["line-limit", "references", "unused-files"]);
  });

  it("keeps skill-authoring/SKILL.md within 200 lines", () => {
    expect(lines(join(authoring, "SKILL.md"))).toBeLessThanOrEqual(200);
  });
});
