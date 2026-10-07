// `kernel-cli/review`, bdk review plan, through the built bundle in real
// repositories: the anchor of each kind, the groups from the plan parts, the
// uncommitted files, binary files, an empty range and the refusals.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, ingestArgs, refused } from "../../../tests/support/repo.ts";
import { executed, opened, started } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";

interface Plan {
  anchor: { kind: string; sha: string };
  head: string;
  range: string;
  dirty: string[];
  measure: { files: number; added: number; removed: number; modules: string[] };
  binary: string[];
  groups: { id: string; kind: string; part?: string; files: string[] }[];
}

function plan(change: Started, ...flags: string[]): Plan {
  return answered(
    bdk(["review", "plan", ...flags, "--json"], change.root),
    "output/review-plan.json",
  ) as unknown as Plan;
}

const rev = (change: Started, ref: string) => git(change.root, "rev-parse", ref).trim();

/** A merged review of the round: the `merge` report with the `head` it stamps. */
function merged(change: Started): string {
  const round = opened(change, "review-fix", change.id);
  answered(
    bdk(
      [
        ...ingestArgs(
          change.root,
          `${round}@merge`,
          "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Review\n",
        ),
        "--json",
      ],
      change.root,
    ),
    "output/log-ingest.json",
  );
  const entry = answered(
    bdk(["log", "add", "report", "clean", "--ticket", `${round}@merge`, "--json"], change.root),
    "output/log-add.json",
  ).entry as { head: string };
  return entry.head;
}

/** A PNG header: git counts a file with a NUL byte as binary. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

function commitSnapshot(change: Started, path: string): void {
  mkdirSync(dirname(join(change.root, path)), { recursive: true });
  writeFileSync(join(change.root, path), PNG);
  git(change.root, "add", path);
  git(change.root, "commit", "--quiet", "-m", "snapshot");
}

function commitFix(change: Started, path: string): void {
  mkdirSync(dirname(join(change.root, path)), { recursive: true });
  writeFileSync(join(change.root, path), "export const fixed = true;\n");
  git(change.root, "add", path);
  git(change.root, "commit", "--quiet", "-m", "fix");
}

describe("bdk review plan", () => {
  it("exit 0: the first round reviews from the Change base, grouped by plan part", () => {
    const change = executed(started());
    commitFix(change, "docs/notes.md");
    const out = plan(change);
    const base = git(change.root, "rev-list", "--max-parents=0", "HEAD").trim();
    expect(out.anchor).toStrictEqual({ kind: "full", sha: base });
    expect(out.head).toBe(rev(change, "HEAD"));
    expect(out.range).toBe(`${base}..${out.head}`);
    expect(out.dirty).toStrictEqual([]);
    expect(out.groups).toStrictEqual([
      { id: "p01", kind: "part", part: "01", files: ["src/01-1.ts", "src/01-2.ts"] },
      { id: "p02", kind: "part", part: "02", files: ["src/02-1.ts"] },
      { id: "unplanned", kind: "unplanned", files: ["docs/notes.md"] },
      {
        id: "integration",
        kind: "integration",
        files: ["docs/notes.md", "src/01-1.ts", "src/01-2.ts", "src/02-1.ts"],
      },
    ]);
    expect(out.measure).toMatchObject({ files: 4, modules: ["docs", "src"] });
    expect(out.binary).toStrictEqual([]);
  });

  it("names the binary files in `binary`, counts them in `measure` and puts them into no group", () => {
    const change = executed(started());
    commitSnapshot(change, "src/__snapshots__/load-error.png");
    const out = plan(change);
    expect(out.binary).toStrictEqual(["src/__snapshots__/load-error.png"]);
    expect(out.measure.files).toBe(4);
    for (const group of out.groups) {
      expect(group.files, group.id).not.toContain("src/__snapshots__/load-error.png");
    }
    expect(out.groups.at(-1)).toStrictEqual({
      id: "integration",
      kind: "integration",
      files: ["src/01-1.ts", "src/01-2.ts", "src/02-1.ts"],
    });
  });

  it("has no groups when only binary files changed since the merged review", () => {
    const change = executed(started());
    merged(change);
    commitSnapshot(change, "src/__snapshots__/load-error.png");
    const out = plan(change);
    expect(out.groups).toStrictEqual([]);
    expect(out.binary).toStrictEqual(["src/__snapshots__/load-error.png"]);
    expect(out.measure.files).toBe(1);
  });

  it("the next round reviews the delta since the merged review; --full overrides it", () => {
    const change = executed(started());
    const head = merged(change);
    commitFix(change, "src/02-1.ts");
    const delta = plan(change);
    expect(delta.anchor).toStrictEqual({ kind: "delta", sha: head });
    expect(delta.groups.map((group) => [group.id, group.files])).toStrictEqual([
      ["p02", ["src/02-1.ts"]],
      ["integration", ["src/02-1.ts"]],
    ]);
    expect(plan(change, "--full").anchor.kind).toBe("full");
  });

  it("falls back to the Change base when the merged review's head is no longer in the repository", () => {
    const change = executed(started());
    const head = merged(change);
    const log = join(change.dir, "log");
    for (const name of readdirSync(log)) {
      const text = readFileSync(join(log, name), "utf8");
      if (text.includes(head)) writeFileSync(join(log, name), text.replace(head, "f".repeat(40)));
    }
    expect(plan(change).anchor.kind).toBe("full");
  });

  it("has no groups when nothing was committed since the merged review", () => {
    const change = executed(started());
    merged(change);
    const out = plan(change);
    expect(out.anchor.kind).toBe("delta");
    expect(out.groups).toStrictEqual([]);
    expect(out.binary).toStrictEqual([]);
    expect(out.measure.files).toBe(0);
  });

  it("anchors a stacked branch on the merge base with --base", () => {
    const change = executed(started());
    git(change.root, "branch", "feature/a", "HEAD~1");
    const out = plan(change, "--base", "feature/a");
    expect(out.anchor).toStrictEqual({
      kind: "base",
      sha: git(change.root, "merge-base", "HEAD", "feature/a").trim(),
    });
  });

  it("names uncommitted tracked files and groups committed history only", () => {
    const change = executed(started());
    const before = plan(change);
    writeFileSync(join(change.root, "src/01-1.ts"), "export const dirty = 1;\n");
    writeFileSync(join(change.root, "src/new.ts"), "export const untracked = 1;\n");
    const out = plan(change);
    expect(out.dirty).toStrictEqual(["src/01-1.ts"]);
    expect(out.groups).toStrictEqual(before.groups);
  });

  it("exit 3 input/invalid-argument: --full with --base, an unknown ref", () => {
    const change = executed(started());
    const run = (...flags: string[]) => bdk(["review", "plan", ...flags, "--json"], change.root);
    refused(run("--full", "--base", "main"), 3, "input/invalid-argument");
    refused(run("--base", "no-such-branch"), 3, "input/invalid-argument");
  });

  it("exit 5 runtime/git-missing: git is not on PATH", () => {
    const change = started();
    refused(
      bdk(["review", "plan", "--json"], change.root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });
});
