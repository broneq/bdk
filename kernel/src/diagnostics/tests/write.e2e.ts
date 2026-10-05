// `bdk diagnostics write` through the built bundle (`kernel-cli/diagnostics`;
// `kernel-state`, Diagnostics analysis file): the five headings, the three
// checks of `## For a BDK issue` with project code allowed above it, and a
// second write that replaces the file.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, read, refused, repository } from "../../../tests/support/repo.ts";

const SESSION = "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11";
const CODE = 'export const languages = ["en", "pl", "de"];';

function project(): string {
  const root = repository({
    ".gitignore": "/.bdk/.machine/\n",
    ".bdk/settings.yaml": "",
    "src/i18n/languages.ts": `// languages\n  ${CODE}\n`,
  });
  mkdirSync(join(root, ".bdk/.machine/telemetry"), { recursive: true });
  const line = {
    v: 1,
    kind: "session",
    at: "2026-10-05T14:00:00.000Z",
    session: SESSION,
    transcript: null,
    source: "startup",
    bdk: "3.0.0",
    commit: null,
    host: null,
  };
  writeFileSync(join(root, ".bdk/.machine/telemetry/journal.jsonl"), `${JSON.stringify(line)}\n`);
  return root;
}

function analysis(
  issue: string,
  wrong = `The worker pasted\n\n\`\`\`ts\n${CODE}\n\`\`\`\n`,
): string {
  return [
    "## Summary",
    "One retry, three refusals.",
    "## What went well",
    "The plan held.",
    "## What went wrong",
    wrong,
    "## Where the fix belongs",
    "The role contract of `lead`.",
    "## For a BDK issue",
    issue,
    "",
  ].join("\n");
}

function write(root: string, markdown: string) {
  return bdk(["diagnostics", "write", "--json"], root, { stdin: markdown });
}

describe("bdk diagnostics write", () => {
  it("stores the whole analysis, project code above the issue section included", () => {
    const root = project();
    const markdown = analysis(
      "`policy/missing-evidence` was refused three times on `bdk attempt close`; role `lead`, ticket `A-k2m4abcd`, key `diagnostics.repeat-read`, `/bdk:execute`, `.bdk/changes/x`.",
    );
    const result = answered(write(root, markdown), "output/diagnostics-write.json");
    expect(result.path).toBe(`.bdk/.machine/diagnostics/${SESSION}.md`);
    expect(read(root, result.path as string)).toBe(markdown);
    expect(git(root, "status", "--porcelain", "--", ".bdk/.machine")).toBe("");
  });

  it("replaces the analysis of the session on a second write", () => {
    const root = project();
    answered(write(root, analysis("first")), "output/diagnostics-write.json");
    answered(write(root, analysis("second")), "output/diagnostics-write.json");
    expect(readdirSync(join(root, ".bdk/.machine/diagnostics"))).toStrictEqual([`${SESSION}.md`]);
    expect(read(root, `.bdk/.machine/diagnostics/${SESSION}.md`)).toContain("second");
  });

  it("refuses a missing heading", () => {
    const refusal = refused(
      write(project(), analysis("x").replace("## For a BDK issue\n", "")),
      3,
      "input/invalid-argument",
    );
    expect(refusal.why).toContain("## For a BDK issue");
  });

  it("refuses a fenced block, an unknown code span and a tracked line in the issue section", () => {
    const root = project();
    const fenced = refused(write(root, analysis("Seen:\n```\nx\n```")), 2, "policy/project-code");
    expect(fenced.why).toBe("line 16 of section For a BDK issue holds a fenced code block");
    const span = refused(
      write(root, analysis("The call `parseLanguages(input)` failed.")),
      2,
      "policy/project-code",
    );
    expect(span.why).toContain("line 15 of section For a BDK issue has a code span");
    const quoted = refused(
      write(root, analysis(`The worker wrote\n${CODE}`)),
      2,
      "policy/project-code",
    );
    expect(quoted.why).toBe(
      "line 16 of section For a BDK issue equals line 2 of src/i18n/languages.ts",
    );
    expect(quoted.instead).toContain("move the quote to a section above For a BDK issue");
    expect(readdirSync(join(root, ".bdk/.machine"))).not.toContain("diagnostics");
  });
});
