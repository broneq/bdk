// `docs-site`, docs-sync dev skill: the skill and its docs map name only
// repository paths that exist. A stale path sends the audit to a file that is
// gone, so the page it maps is never re-checked. Paths with a placeholder
// (`<name>`, `*`) and shorthand siblings (`plan/` after `skills/stages/design/`)
// are left out; a path is checked when it starts at a repository root
// directory or is a root Markdown file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

const FILES = [
  ".claude/skills/docs-sync/SKILL.md",
  ".claude/skills/docs-sync/references/docs-map.md",
];

const ROOTS = [
  ".claude",
  ".claude-plugin",
  ".github",
  "agents",
  "docs",
  "evals",
  "fragments",
  "hooks",
  "kernel",
  "plugins",
  "rules",
  "skills",
  "tests",
];

const PATH = new RegExp(
  `\`((?:${ROOTS.map((root) => root.replace(".", "\\.")).join("|")})/[^\`\\s]*|[A-Z_]+\\.md)\``,
  "g",
);

/** The repository paths `text` names, without placeholders. */
function namedPaths(text: string): string[] {
  return [...text.matchAll(PATH)]
    .map((match) => match[1] ?? "")
    .filter((path) => !/[<>*]|\.\.\./.test(path));
}

describe("docs-sync names existing paths", () => {
  it("reads repository paths and skips placeholders", () => {
    expect(
      namedPaths(
        "`skills/stages/setup/` `skills/<name>/SKILL.md` `agents/*.md` `README.md` `plan/`",
      ),
    ).toStrictEqual(["skills/stages/setup/", "README.md"]);
  });

  it.each(FILES)("%s names only paths that exist", (file) => {
    const missing = namedPaths(readFileSync(join(REPO_ROOT, file), "utf8")).filter(
      (path) => !existsSync(join(REPO_ROOT, path)),
    );
    expect(missing).toStrictEqual([]);
  });
});
