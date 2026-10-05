// `plugin-tooling`, Repository rules managed by the kernel (T50): BDK's own
// development rules live under `.bdk/rules/` as a user project's do, and
// `.claude/rules/` holds only the projection `bdk rules export --claude` writes.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT, runBdk } from "../support/run.ts";

describe("repository rules managed by the kernel", () => {
  it(".claude/rules/ holds only the generated projection", () => {
    const handWritten = readdirSync(join(REPO_ROOT, ".claude/rules")).filter(
      (name) => !/^bdk-generated(?:-scoped)?\.md$/.test(name),
    );
    expect(
      handWritten,
      "write each rule as a bullet under .bdk/rules/ (bdk rules import), then run bdk rules export --claude",
    ).toEqual([]);
  });

  it("the projection is up to date and the rules check", () => {
    const exported = runBdk(["rules", "export", "--claude", "--check", "--json"], REPO_ROOT);
    expect(exported.code, `${exported.stdout}${exported.stderr}run bdk rules export --claude`).toBe(
      0,
    );
    const checked = runBdk(["rules", "check", "--json"], REPO_ROOT);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
  });
});
