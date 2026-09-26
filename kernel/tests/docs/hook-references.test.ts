// `docs-site`, Drift guard 4: prose never names a repository-root hook path
// that does not exist. A plugin hook is named only as a string, so a wrong
// path is silently inert (issue #38). The negative control seeds a dangling
// path into the scanned set.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

interface Scanned {
  readonly path: string;
  readonly text: string;
}

function markdownUnder(dir: string, recursive: boolean): string[] {
  const root = join(REPO_ROOT, dir);
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive, encoding: "utf8" })
    .filter((path) => path.endsWith(".md"))
    .map((path) => `${dir}/${path.split("\\").join("/")}`);
}

// The files whose prose may name a hook.
const SCANNED = [
  ...markdownUnder("skills", true),
  ...markdownUnder("docs/guide", true),
  ...markdownUnder("rules", false),
  ...markdownUnder("agents", false),
  ...markdownUnder(".claude/rules", false),
  "STARTUP_INSTRUCTIONS.md",
  "README.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "hooks/hooks.json",
]
  .sort()
  .map((path): Scanned => ({ path, text: readFileSync(join(REPO_ROOT, path), "utf8") }));

// `hooks/<dir>`, optionally followed by `/<file>`. The leading group rejects a
// match preceded by a path character, so `tests/unit/hooks/...` and
// `.claude/hooks/...` are not read as repository-root paths.
const HOOK_PATH = /(?:^|[^A-Za-z0-9_./-])(hooks\/[A-Za-z0-9_<>.-]+(?:\/[A-Za-z0-9_<>.-]+)?)/g;

/** `file:line names 'hooks/...'` for every named hook path that does not exist. */
function danglingHookPaths(files: readonly Scanned[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    file.text.split("\n").forEach((line, index) => {
      for (const match of line.matchAll(HOOK_PATH)) {
        const reference = (match[1] ?? "").replace(/[.,;:)`'"]+$/, "");
        // `hooks/<hook-name>` is a documentation template, not a claim.
        if (reference.includes("<") || reference.includes(">")) continue;
        if (!existsSync(join(REPO_ROOT, reference))) {
          found.push(`${file.path}:${index + 1} names '${reference}'`);
        }
      }
    });
  }
  return found;
}

describe("hook paths in prose", () => {
  it("scans the site, skills, rules, agents and the root documents", () => {
    expect(SCANNED.some((file) => file.path.startsWith("docs/guide/"))).toBe(true);
    expect(SCANNED.some((file) => file.path.startsWith("skills/"))).toBe(true);
  });

  it("names only hook paths that exist", () => {
    expect(danglingHookPaths(SCANNED)).toStrictEqual([]);
  });

  it("reports a seeded dangling path with its file and line", () => {
    const seeded = { path: "skills/seed/SKILL.md", text: "intro\nRun `hooks/nope/x.py` first.\n" };
    expect(danglingHookPaths([...SCANNED, seeded])).toStrictEqual([
      "skills/seed/SKILL.md:2 names 'hooks/nope/x.py'",
    ]);
  });

  it("ignores templates and paths under another tree", () => {
    const seeded = {
      path: "CLAUDE.md",
      text: "hooks/<hook-name>/check.py and tests/unit/hooks/nope/x.py and .claude/hooks/nope\n",
    };
    expect(danglingHookPaths([seeded])).toStrictEqual([]);
  });
});
