// `bdk measure` through the committed bundle in a real repository: every exit
// code and declared rule, the output schema, and the T20 acceptance case that
// the same range gives byte-identical output.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  git,
  outsideRepository,
  refused,
  repository,
} from "../../../tests/support/repo.ts";

/** A repository with a second commit touching two modules and the ledger. */
function changed(): string {
  const root = repository({
    "src/auth/login.ts": "a\nb\n",
    "docs/guide.md": "x\n",
    "lib/util.ts": "u\n",
  });
  git(root, "tag", "base");
  writeFileSync(join(root, "src/auth/login.ts"), "a\nb\nc\n");
  writeFileSync(join(root, "docs/guide.md"), "y\n");
  writeFileSync(join(root, "README.md"), "# app\n\nMore.\n");
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "work");
  return root;
}

describe("bdk measure", () => {
  it("exit 0: diff signals of <base>..<head>", () => {
    const root = changed();
    const result = answered(bdk(["measure", "base..HEAD", "--json"], root), "output/measure.json");
    expect(result).toEqual({
      range: "base..HEAD",
      files: 3,
      added: 4,
      removed: 1,
      lines: 5,
      modules: ["README.md", "docs", "src/auth"],
    });
  });

  it("acceptance: the same range twice gives byte-identical output", () => {
    const root = changed();
    const first = bdk(["measure", "base", "--json"], root);
    const second = bdk(["measure", "base", "--json"], root);
    expect(first.code).toBe(0);
    expect(second.stdout).toBe(first.stdout);
  });

  it("<base> includes an uncommitted change, <base>..HEAD only the commits", () => {
    const root = changed();
    writeFileSync(join(root, "lib/util.ts"), "u\nv\n");

    const workingTree = answered(bdk(["measure", "base", "--json"], root), "output/measure.json");
    const committed = answered(
      bdk(["measure", "base..HEAD", "--json"], root),
      "output/measure.json",
    );
    expect(workingTree).toMatchObject({ files: 4, lines: 6 });
    expect(committed).toMatchObject({ files: 3, lines: 5 });
    expect(workingTree.modules).toContain("lib");
    expect(committed.modules).not.toContain("lib");
  });

  it("exit 3 input/invalid-argument: an unknown ref", () => {
    refused(bdk(["measure", "nope", "--json"], repository()), 3, "input/invalid-argument");
  });

  it("exit 3 input/invalid-argument: a malformed range", () => {
    refused(bdk(["measure", "a...b", "--json"], repository()), 3, "input/invalid-argument");
  });

  it("exit 5 runtime/git-missing: git is not on PATH", () => {
    refused(bdk(["measure", "--json"], repository(), { git: false }), 5, "runtime/git-missing");
  });

  it("exit 5 runtime/not-a-repo: outside a work tree", () => {
    refused(bdk(["measure", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});
