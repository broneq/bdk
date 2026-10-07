// The package template's pure parts (`kernel-cli/dispatch`; T23-D33):
// normalisation for the hash and the role body's heading shift.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../../../tests/support/run.ts";
import { normalise, renderSections } from "../domain/template.ts";
import { ENTRY_TYPES } from "../../shared/vocabulary/index.ts";

describe("normalise", () => {
  it("drops the frontmatter, CR line ends and trailing whitespace", () => {
    expect(normalise("---\nname: x\n---\n# Title  \r\nText\t\r\n\n")).toBe("# Title\nText");
  });

  it("leaves a text without frontmatter as is, trimmed", () => {
    expect(normalise("\nText\n")).toBe("Text");
  });
});

describe("the return section (T46)", () => {
  const values: Record<string, string> = { ref: "A-1", report: "r.md", draft: "d.md" };
  const filled = new Proxy(values, { get: (target, key: string) => target[key] ?? "x" });
  const text = renderSections(filled, []).find((section) => section.name === "return")?.text ?? "";

  it("names the summary limit, the entry types and the ids to list", () => {
    expect(text).toContain("1 to 120 characters");
    for (const type of ENTRY_TYPES.filter((entry) => entry !== "transition")) {
      expect(text).toContain(type);
    }
    expect(text).toContain("the ids `log add` printed");
  });

  it("names the draft, the --file form of log ingest and never a pipe (#166)", () => {
    expect(text).toContain("with your file tool to `d.md`");
    expect(text).toContain("`bdk log ingest --ticket A-1 --file d.md`");
    expect(text).toContain("never pipe it");
    expect(text).not.toContain(" < ");
    expect(text).toContain("Leave `reason` out");
  });
});

describe("the merge-conflicts fragment (T45)", () => {
  const text = readFileSync(join(REPO_ROOT, "fragments/merge-conflicts.md"), "utf8");

  it("regenerates lockfiles instead of merging them, for every common package manager", () => {
    expect(text).toMatch(/regenerate the lockfile with the project's package manager/);
    for (const lockfile of [
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "Cargo.lock",
      "poetry.lock",
      "uv.lock",
      "go.sum",
      "Gemfile.lock",
      "composer.lock",
    ]) {
      expect(text).toContain(`\`${lockfile}\``);
    }
  });

  it("names no BDK flow, so any merge can reuse it", () => {
    expect(text).not.toMatch(/\bbdk\b|ticket|part /i);
  });
});
