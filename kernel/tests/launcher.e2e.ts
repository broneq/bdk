// `kernel-architecture`, Plugin launcher: `bin/bdk` runs the bundle with the
// caller's argv, stdin, working directory and exit code, and reports a missing
// `node` or bundle with exit 5 instead of a shell error.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repository } from "./support/repo.ts";
import { REPO_ROOT, runBdk } from "./support/run.ts";

const LAUNCHER = join(REPO_ROOT, "bin", "bdk");

interface Launch {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

function launch(
  launcher: string,
  args: readonly string[],
  options: { cwd?: string; stdin?: string; path?: string } = {},
): Launch {
  const result = spawnSync("/bin/sh", [launcher, ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    input: options.stdin ?? "",
    env: { ...process.env, PATH: options.path ?? process.env.PATH ?? "" },
  });
  if (result.error !== undefined) throw result.error;
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/** A plugin copy with the real launcher and a stub bundle that echoes what it received. */
function stubPlugin(): string {
  const root = mkdtempSync(join(tmpdir(), "bdk-launcher-"));
  mkdirSync(join(root, "bin"));
  mkdirSync(join(root, "dist"));
  copyFileSync(LAUNCHER, join(root, "bin", "bdk"));
  writeFileSync(
    join(root, "dist", "bdk.mjs"),
    [
      'import { readFileSync } from "node:fs";',
      'const stdin = readFileSync(0, "utf8");',
      "console.log(JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd() }));",
      'process.exitCode = Number(process.env.STUB_EXIT ?? "0");',
    ].join("\n"),
  );
  return root;
}

/** A PATH with only the directory of the running node, so `node` resolves and nothing else does. */
const NODE_ONLY_PATH = join(process.execPath, "..");

describe("bin/bdk", () => {
  it("passes words with spaces, stdin and the working directory through", () => {
    const root = stubPlugin();
    const cwd = mkdtempSync(join(tmpdir(), "bdk-launcher-cwd-"));
    const result = launch(join(root, "bin", "bdk"), ["log", "add", "x y", "--body", "-"], {
      cwd,
      stdin: "body line\n",
      path: NODE_ONLY_PATH,
    });
    expect(result.code).toBe(0);
    const seen = JSON.parse(result.stdout) as { argv: string[]; stdin: string; cwd: string };
    expect(seen.argv).toEqual(["log", "add", "x y", "--body", "-"]);
    expect(seen.stdin).toBe("body line\n");
    expect(seen.cwd).toMatch(/bdk-launcher-cwd-/);
  });

  it("answers like the bundle run by its path", () => {
    const viaLauncher = launch(LAUNCHER, ["version", "--json"]);
    const viaPath = runBdk(["version", "--json"], REPO_ROOT);
    expect(viaLauncher.code).toBe(0);
    expect(JSON.parse(viaLauncher.stdout)).toEqual(viaPath.json);
  });

  it("answers change status in a project like the bundle run by its path", () => {
    const project = repository();
    const viaLauncher = launch(LAUNCHER, ["change", "status", "--json"], { cwd: project });
    const viaPath = runBdk(["change", "status", "--json"], project);
    expect(viaLauncher.code).toBe(viaPath.code);
    expect(JSON.parse(viaLauncher.stdout)).toEqual(viaPath.json);
  });

  it("exits with the kernel's exit code", () => {
    const result = launch(LAUNCHER, ["no-such-command", "--json"]);
    expect(result.code).toBe(3);
    expect(JSON.parse(result.stdout)).toMatchObject({ rule: "input/unknown-command" });
  });

  it("runs bdk --version", () => {
    const result = launch(LAUNCHER, ["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(runBdk(["version"], REPO_ROOT).stdout);
  });

  it("reports a missing node with exit 5 and nothing on stdout", () => {
    const empty = mkdtempSync(join(tmpdir(), "bdk-launcher-path-"));
    const result = launch(LAUNCHER, ["version"], { path: empty });
    expect(result.code).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "bdk: kernel unavailable: node is not on PATH; install Node >= 22.13 and run /bdk:setup\n",
    );
  });

  it("reports a missing bundle with exit 5", () => {
    const root = mkdtempSync(join(tmpdir(), "bdk-launcher-nobundle-"));
    mkdirSync(join(root, "bin"));
    copyFileSync(LAUNCHER, join(root, "bin", "bdk"));
    const result = launch(join(root, "bin", "bdk"), ["version"], { path: NODE_ONLY_PATH });
    expect(result.code).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      `bdk: kernel unavailable: ${join(root, "dist", "bdk.mjs")} is missing; reinstall the BDK plugin\n`,
    );
  });
});
