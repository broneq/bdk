// A formatter over committed state (T51, #140; `kernel-state`, Committed state
// is hashed byte for byte, Formatter guard): the repository's pinned prettier
// leaves `.bdk/` alone while the kernel-owned `.bdk/.prettierrc` is in place,
// finds kernel output already formatted without it, and a rewrite by
// non-default options shows as a stale node and a `merge-hash` finding.
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";
import { fileStore } from "../../shared/store/index.ts";
import { creating, reviewed } from "./e2e-support.ts";
import type { Reviewed } from "./e2e-support.ts";

const SPEC = ".bdk/specs/auth/login/spec.md";
const PRETTIER = join(REPO_ROOT, "node_modules", ".bin", "prettier");

/** The reviewed Change with `auth/login` merged, everything committed. */
function mergedAndCommitted(): Reviewed {
  const change = reviewed({ deltas: { "auth/login": creating(["Magic link sent", ["sent"]]) } });
  answered(bdk(["spec", "merge", "--json"], change.root), "output/spec-merge.json");
  git(change.root, "add", "-A");
  git(change.root, "commit", "--quiet", "-m", "merge");
  return change;
}

function prettierWrite(root: string, ...options: string[]): void {
  execFileSync(PRETTIER, ["--write", ".", ...options], { cwd: root, stdio: "ignore" });
}

/** Deletes and commits the deletion of the formatter guard. */
function withoutGuard(root: string): void {
  git(root, "rm", "--quiet", ".bdk/.prettierrc");
  git(root, "commit", "--quiet", "-m", "drop the guard");
}

/** Markdown under `.bdk/` that the kernel writes, as opposed to the host's plan parts and deltas. */
function kernelMarkdown(line: string): boolean {
  return line.endsWith(".md") && !/\/(plan\/parts|design\/parts|spec-delta)\//.test(line);
}

function changedUnderBdk(root: string): string[] {
  return git(root, "status", "--porcelain", "--", ".bdk/")
    .split("\n")
    .filter((line) => line.trim() !== "");
}

function planPart(root: string): { state: string; why?: string } {
  const chain = answered(bdk(["explain", "plan", "--json"], root), "output/explain.json").chain as {
    id: string;
    state: string;
    why?: string;
  }[];
  const node = chain.find((entry) => entry.id === "plan-part:01");
  if (node === undefined) throw new Error("plan-part:01 missing from explain plan");
  return node;
}

function mergeHashFindings(root: string): unknown[] {
  const doctor = answered(bdk(["doctor", "--json"], root), "output/doctor.json");
  return (doctor.findings as { id: string }[]).filter((finding) => finding.id === "merge-hash");
}

describe("a formatter over committed state", () => {
  it("prettier over a reviewed Change without the guard: stale plan part and the merge hash", () => {
    const change = mergedAndCommitted();
    expect(planPart(change.root).state).toBe("done");
    withoutGuard(change.root);

    prettierWrite(change.root, "--prose-wrap", "always", "--print-width", "40");

    expect(changedUnderBdk(change.root)).not.toStrictEqual([]);
    const part = planPart(change.root);
    expect(part.state).toBe("stale");
    expect(part.why).toMatch(/recorded sha256:[0-9a-f]{64}, current sha256:[0-9a-f]{64}/);
    expect(mergeHashFindings(change.root)).toStrictEqual([
      expect.objectContaining({
        level: "fail",
        summary: `${SPEC} was edited outside spec merge: content hash differs from bdk-merge-hash`,
      }),
    ]);
    expect(bdk(["log", "list", "--json"], change.root).code).toBe(0);
  });

  it("prettier with .bdk/ ignored by the guard: nothing under .bdk/ changes", () => {
    const change = mergedAndCommitted();

    prettierWrite(change.root, "--prose-wrap", "always", "--print-width", "40");

    expect(changedUnderBdk(change.root)).toStrictEqual([]);
    expect(planPart(change.root).state).toBe("done");
    expect(mergeHashFindings(change.root)).toStrictEqual([]);
  });

  it("default prettier without the guard changes no Markdown file the kernel wrote", () => {
    const change = mergedAndCommitted();
    withoutGuard(change.root);

    prettierWrite(change.root);

    expect(changedUnderBdk(change.root).filter(kernelMarkdown)).toStrictEqual([]);
    expect(mergeHashFindings(change.root)).toStrictEqual([]);
  });

  it("explicit paths are skipped under the guard, from the root and from a subdirectory", () => {
    const change = mergedAndCommitted();
    const rule = ".bdk/rules/API-1.md";
    // JSON has no pragma support: the guard's override is what skips a capture.
    const capture = `.bdk/changes/${change.id}/evidence/01-1-E-unformat-lint.json`;
    fileStore().write(join(change.root, capture), '{"a":1,\n"b":[1,2]}\n');
    fileStore().write(
      join(change.root, rule),
      '---\nschema: 1\nid: API-1\nkind: house\npaths: ["**"]\nstages: [plan]\nseverity: medium\norigin: user\nsince: 2026-10-06\n---\n*   Badly   formatted.\n',
    );
    const check = (cwd: string, path: string) =>
      spawnSync(PRETTIER, ["--check", path], { cwd, encoding: "utf8" }).status;

    expect(check(change.root, rule)).toBe(0);
    expect(check(change.root, capture)).toBe(0);
    expect(check(join(change.root, ".bdk/rules"), "API-1.md")).toBe(0);
    withoutGuard(change.root);
    expect(check(change.root, rule)).not.toBe(0);
    expect(check(change.root, capture)).not.toBe(0);
  });
});
