// `docs-site`, README v3: the README is the entry point and the site the
// reference. It states the requirements once, has a quick start that runs
// `/bdk:setup` and `/bdk:run`, links to the migration page, and frames nothing
// in v2 terms. Every relative link it holds resolves, since the strict site
// build never reads the README.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";

const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");

/** The body of the level-2 section whose heading is `title`, or "". */
function section(text: string, title: string): string {
  const parts = text.split(/^## /m);
  const found = parts.find((part) => part.startsWith(`${title}\n`));
  return found ?? "";
}

/** Every relative link target, without its anchor. */
function relativeLinks(text: string): string[] {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => (match[1] ?? "").split("#")[0] ?? "")
    .filter((target) => target !== "" && !/^[a-z]+:/.test(target));
}

describe("README v3", () => {
  it("states the requirements once", () => {
    expect(readme.match(/\*\*Requirements:\*\*/g) ?? []).toHaveLength(1);
    expect(readme.match(/22\.13/g) ?? []).toHaveLength(1);
  });

  it("has a quick start that runs /bdk:setup and /bdk:run", () => {
    const quickStart = section(readme, "Quick start");
    expect(quickStart).toContain("/bdk:setup");
    expect(quickStart).toContain("/bdk:run");
  });

  it("links to the migration page", () => {
    expect(readme).toContain("docs/guide/getting-started/migration-from-v2.md");
  });

  it("does not present STARTUP_INSTRUCTIONS.md as environment discovery", () => {
    const lines = readme.split("\n").filter((line) => line.includes("STARTUP_INSTRUCTIONS.md"));
    expect(lines.filter((line) => /discover/i.test(line))).toStrictEqual([]);
  });

  it("links only to files that exist", () => {
    expect(
      relativeLinks(readme).filter((target) => !existsSync(join(REPO_ROOT, target))),
    ).toStrictEqual([]);
  });
});
