import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Spec `bdk-plugin`, "No run file named like a refused report": every BDK block may run as a
// subagent, and Claude Code refuses a subagent's `Write` to a file whose base name matches this
// pattern ("Subagents should return findings as text, not write report files"). Copied from the
// `Write` tool's input check of Claude Code 2.1.294.
const REFUSED = /^(REPORT|SUMMARY|FINDINGS|ANALYSIS).*\.md$/i;

const PLUGIN = join(import.meta.dirname, "..");
const ROOTS = ["skills", "agents", "src"];
// A Markdown file name as skill text and code write it: `review/round-<N>/review.md`, `"round.md"`.
const MD_NAME = /[\w<>{}$./-]*\.md\b/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === "tests" ? [] : walk(join(dir, entry.name));
    return [join(dir, entry.name)];
  });
}

/** The refused file names a text names, as `<file>: <name>`. */
function refusedNames(file: string, text: string): string[] {
  const names = text.match(MD_NAME) ?? [];
  return [...new Set(names.filter((name) => REFUSED.test(basename(name))))].map(
    (name) => `${file}: ${name}`,
  );
}

describe("refused file names", () => {
  it("matches the names the host refuses and passes BDK's own", () => {
    for (const name of ["summary.md", "Report.md", "FINDINGS-1.md", "analysis.md"]) {
      expect(REFUSED.test(name), name).toBe(true);
    }
    for (const name of ["review.md", "round.md", "result.md", "spec-conformance.md"]) {
      expect(REFUSED.test(name), name).toBe(false);
    }
  });

  it("finds a refused name in skill text", () => {
    const text = "Write `.bdk/runs/<change>/execute/summary.md`, then `review/round-1/Report.md`.";
    expect(refusedNames("skills/x/SKILL.md", text)).toEqual([
      "skills/x/SKILL.md: .bdk/runs/<change>/execute/summary.md",
      "skills/x/SKILL.md: review/round-1/Report.md",
    ]);
  });

  it("no skill, agent or CLI source names a file the host refuses", () => {
    const found = ROOTS.flatMap((root) =>
      walk(join(PLUGIN, root)).flatMap((path) =>
        refusedNames(relative(PLUGIN, path).split(sep).join("/"), readFileSync(path, "utf8")),
      ),
    );
    expect(found).toEqual([]);
  });
});
