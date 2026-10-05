// A formatter over committed state (T51, `kernel-state`, Committed state is
// hashed byte for byte): the repository's pinned prettier rewrites `.bdk/`
// files, which the kernel shows as a stale node and a `merge-hash` finding,
// and leaves them alone once the project's own ignore list names `.bdk/`.
import { execFileSync } from "node:child_process";
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

function prettierWrite(root: string): void {
  execFileSync(PRETTIER, ["--write", "."], { cwd: root, stdio: "ignore" });
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
  it("prettier rewrites .bdk/: the plan part goes stale and doctor reports the merge hash", () => {
    const change = mergedAndCommitted();
    expect(planPart(change.root).state).toBe("done");

    prettierWrite(change.root);

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

  it("with .bdk/ in .prettierignore nothing under .bdk/ changes and the Change stays done", () => {
    const change = mergedAndCommitted();
    fileStore().write(join(change.root, ".prettierignore"), ".bdk/\n");

    prettierWrite(change.root);

    expect(changedUnderBdk(change.root)).toStrictEqual([]);
    expect(planPart(change.root).state).toBe("done");
    expect(mergeHashFindings(change.root)).toStrictEqual([]);
  });
});
