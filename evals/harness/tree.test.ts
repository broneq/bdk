import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { assertCommitted, headCommit } from "./tree.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-tree-"));
  dirs.push(dir);
  const git = (...args: string[]): void => {
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@x", ...args], {
      cwd: dir,
      env: GIT_ENV,
    });
  };
  git("init", "-q", "-b", "main");
  writeFileSync(join(dir, "a.txt"), "a\n");
  git("add", "a.txt");
  git("commit", "-q", "-m", "base");
  return dir;
}

describe("assertCommitted", () => {
  it("passes on a clean tree and with new result rows only", () => {
    const dir = repo();
    expect(() => {
      assertCommitted(dir);
    }).not.toThrow();
    mkdirSync(join(dir, "evals/results/x"), { recursive: true });
    writeFileSync(join(dir, "evals/results/x/series.jsonl"), "{}\n");
    expect(() => {
      assertCommitted(dir);
    }).not.toThrow();
  });

  it("names the changed files otherwise", () => {
    const dir = repo();
    writeFileSync(join(dir, "a.txt"), "b\n");
    expect(() => {
      assertCommitted(dir);
    }).toThrow(/commit the working tree before a series[\s\S]*a\.txt/);
  });
});

describe("headCommit", () => {
  it("is the full HEAD commit", () => {
    expect(headCommit(repo())).toMatch(/^[0-9a-f]{40}$/);
  });
});
