// `kernel-cli`, Invocation (stdin) through the built bundle (#166): no
// command waits on a stdin that never closes, as an agent's shell inherits
// one. `log ingest` never reads stdin; the commands that read a body give up
// after STDIN_WAIT_SECONDS with `input/stdin-unavailable`.
import { describe, expect, it } from "vitest";

import { bdk, bdkOpenStdin, refused, repository } from "../../../../tests/support/repo.ts";

/** A repository with an open Change; answers its root. */
function opened(): string {
  const root = repository();
  const result = bdk(["change", "new", "Users log in with a one-time link", "--json"], root);
  expect(result.code, result.stdout).toBe(0);
  return root;
}

describe("stdin that never closes", () => {
  it("log ingest without --file refuses at once with input/missing-argument", async () => {
    const result = await bdkOpenStdin(
      ["log", "ingest", "--ticket", "A-9c2d4f6h", "--json"],
      opened(),
      20_000,
    );
    refused(result, 3, "input/missing-argument");
    expect(result.ms).toBeLessThan(2_500);
  });

  it.each([
    [
      "log add --body -",
      ["log", "add", "decision", "Keep magic links", "--ref", "x", "--body", "-"],
    ],
    [
      "rules accept -",
      ["rules", "accept", "-", "--prefix", "API", "--path", "src/**", "--stage", "execute"],
    ],
    ["review render --pr -", ["review", "render", "--pr", "-", "--out", "pr.html"]],
    ["diagnostics write", ["diagnostics", "write"]],
  ])("%s refuses with input/stdin-unavailable after the wait", async (_, argv) => {
    const result = await bdkOpenStdin([...argv, "--json"], opened(), 20_000);
    refused(result, 3, "input/stdin-unavailable");
    expect(result.ms).toBeGreaterThanOrEqual(2_900);
    expect(result.ms).toBeLessThan(6_000);
  });

  it("a pipe with data is read as before", () => {
    const root = opened();
    const result = bdk(
      ["log", "add", "decision", "Keep magic links", "--ref", "x", "--body", "-", "--json"],
      root,
      { stdin: "Chosen for the MVP.\n" },
    );
    expect(result.code, result.stdout).toBe(0);
  });
});
