import { describe, expect, it } from "vitest";

import { REPO_ROOT, SANDBOX_DIR, sandboxOf } from "./paths.ts";

describe("sandboxOf", () => {
  it("places a series' sandbox under the sandbox root, outside the repository", () => {
    expect(sandboxOf("execute-ab", "series-1")).toBe(`${SANDBOX_DIR}/execute-ab/series-1`);
    expect(sandboxOf("execute-ab", "series-1", "/cache/bdk-evals", "/repo")).toBe(
      "/cache/bdk-evals/execute-ab/series-1",
    );
  });

  it("refuses a sandbox inside the repository", () => {
    expect(() => sandboxOf("execute-ab", "series-1", `${REPO_ROOT}/evals/.cache`)).toThrow(
      /inside the BDK repository/,
    );
  });
});
