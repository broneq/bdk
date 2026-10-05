// Every git a test runs, directly or through the kernel, inherits the
// worker's environment. `git commit` starts `git maintenance run --auto
// --detach`, which on recent git writes under `.git/objects/pack` while
// `afterEach` removes the repository (ENOTEMPTY); vitest.config.ts turns
// automatic maintenance off for every project.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

let root: string | undefined;
afterEach(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
});

it("runs git with automatic maintenance and gc off", () => {
  root = mkdtempSync(join(tmpdir(), "bdk-maintenance-"));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  const get = (key: string) =>
    execFileSync("git", ["config", "--get", key], { cwd: root, encoding: "utf8" }).trim();
  expect(get("maintenance.auto")).toBe("false");
  expect(get("gc.auto")).toBe("0");
});
