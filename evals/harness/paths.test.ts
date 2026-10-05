import { describe, expect, it } from "vitest";

import { REPO_ROOT, SANDBOX_DIR, sandboxOf } from "./paths.ts";

describe("sandboxOf", () => {
  it("places a series' sandbox under the sandbox root and the checkout, outside the repository", () => {
    expect(sandboxOf("execute-ab", "series-1")).toMatch(
      new RegExp(`^${SANDBOX_DIR}/[\\w.-]+-[0-9a-f]{8}/execute-ab/series-1$`),
    );
    expect(sandboxOf("execute-ab", "series-1", "/cache/bdk-evals", "/repo")).toBe(
      "/cache/bdk-evals/repo-816fc349/execute-ab/series-1",
    );
  });

  it("gives two checkouts of one series different sandboxes", () => {
    // Two worktrees name their series alike from their own results; a shared
    // sandbox would let one run reset the other's working copy.
    const a = sandboxOf("stages", "probe-run-2026-10-05", "/cache/bdk-evals", "/repo");
    const b = sandboxOf(
      "stages",
      "probe-run-2026-10-05",
      "/cache/bdk-evals",
      "/repo/.claude/worktrees/T49",
    );
    expect(a).not.toBe(b);
  });

  it("refuses a sandbox inside the repository", () => {
    expect(() => sandboxOf("execute-ab", "series-1", `${REPO_ROOT}/evals/.cache`)).toThrow(
      /inside the BDK repository/,
    );
  });
});
