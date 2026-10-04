// A real git repository on branch `feat/login` for the E2E cases of the
// state commands, and the bundle run in it with git and the global layer
// isolated from the machine: no user or system git config, the global BDK
// layer inside the fixture, and a PATH without git for `runtime/git-missing`.
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect } from "vitest";

import { createFixture } from "./fixture.ts";
import type { Fixture } from "./fixture.ts";
import { BUNDLE, REPO_ROOT, runBdk } from "./run.ts";
import type { RunResult } from "./run.ts";
import { validatorFor } from "./schemas.ts";

export const BRANCH = "feat/login";

const GIT_ENV: Record<string, string> = {
  ...(process.env as Record<string, string>),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "BDK Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "BDK Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

const fixtures: Fixture[] = [];
afterEach(() => {
  for (const created of fixtures.splice(0)) created.remove();
});

export function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, env: GIT_ENV, encoding: "utf8" });
}

/** A repository with one commit holding `files`, checked out on BRANCH. */
export function repository(files: Record<string, string> = {}): string {
  const created = createFixture({ files: { "README.md": "# app\n", ...files } });
  fixtures.push(created);
  git(created.root, "checkout", "--quiet", "-b", BRANCH);
  git(created.root, "add", "--all");
  git(created.root, "commit", "--quiet", "-m", "initial");
  return created.root;
}

/** A directory outside any git work tree. */
export function outsideRepository(): string {
  const created = createFixture({ git: false });
  fixtures.push(created);
  return created.root;
}

function envFor(root: string, withGit: boolean): Record<string, string> {
  const env: Record<string, string> = {
    ...GIT_ENV,
    XDG_CONFIG_HOME: join(root, ".xdg"),
    HOME: root,
  };
  if (!withGit) {
    const empty = join(root, ".no-git-bin");
    mkdirSync(empty, { recursive: true });
    env.PATH = empty;
  }
  return env;
}

export interface BdkOptions {
  readonly stdin?: string;
  /** false runs the bundle with a PATH on which git is not found. */
  readonly git?: boolean;
}

/** `bdk <args>` through the built bundle in `root`. */
export function bdk(args: readonly string[], root: string, options: BdkOptions = {}): RunResult {
  return runBdk(args, root, {
    env: envFor(root, options.git ?? true),
    ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
  });
}

/** `bdk <args>` without waiting, so several can run at once. */
export function bdkAsync(args: readonly string[], root: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BUNDLE, ...args], {
      cwd: root,
      env: { ...envFor(root, true), CLAUDE_PLUGIN_ROOT: REPO_ROOT },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      let json: unknown;
      try {
        json = JSON.parse(stdout);
      } catch {
        json = undefined;
      }
      resolve({ code: code ?? -1, stdout, stderr, json });
    });
    child.stdin.end();
  });
}

const validRefusal = validatorFor("common/refusal.json");

/** Asserts a refusal with `code` and `rule` whose object validates; returns it. */
export function refused(
  result: RunResult,
  code: number,
  rule: string,
): { why: string; instead: string[] } {
  expect(result.json, result.stdout).toMatchObject({ rule });
  expect(result.code).toBe(code);
  expect(validRefusal(result.json), JSON.stringify(validRefusal.errors)).toBe(true);
  return result.json as { why: string; instead: string[] };
}

/** Asserts exit 0 and that the output validates against `schema`; returns the object. */
export function answered(result: RunResult, schema: string): Record<string, unknown> {
  const valid = validatorFor(schema);
  expect(result.code, result.stdout + result.stderr).toBe(0);
  expect(valid(result.json), JSON.stringify(valid.errors)).toBe(true);
  return result.json as Record<string, unknown>;
}

export function read(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}
