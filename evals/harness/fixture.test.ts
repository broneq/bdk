import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FixtureMismatch, freshCopy, npmCi, prepareFixture } from "./fixture.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-fixture-"));
  dirs.push(dir);
  return dir;
}

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@x", ...args], {
    cwd,
    env: GIT_ENV,
    encoding: "utf8",
  }).trim();
}

/** A local upstream standing in for the fixture repository, with agent files to strip. */
function upstream(): { url: string; commit: string } {
  const dir = temp();
  git(dir, "init", "-q", "-b", "main");
  mkdirSync(join(dir, ".claude/skills/x"), { recursive: true });
  mkdirSync(join(dir, ".agents"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, ".claude/skills/x/SKILL.md"), "x\n");
  writeFileSync(join(dir, ".agents/plan.md"), "p\n");
  writeFileSync(join(dir, "CLAUDE.md"), "@AGENTS.md\n");
  writeFileSync(join(dir, "AGENTS.md"), "rules\n");
  writeFileSync(join(dir, "src/app.ts"), "export const a = 1;\n");
  git(dir, "add", "--all");
  git(dir, "commit", "-q", "-m", "first");
  const commit = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, "src/app.ts"), "export const a = 2;\n");
  git(dir, "commit", "-q", "-am", "second");
  return { url: `file://${dir}`, commit };
}

describe("prepareFixture", () => {
  it("fetches the pinned commit, strips agent files and commits the base on feat/eval", () => {
    const { url, commit } = upstream();
    const installed: string[] = [];
    const base = prepareFixture({ repository: url, commit }, temp(), {
      install: (dir) => installed.push(dir),
    });
    expect(git(base, "rev-parse", "HEAD^")).toBe(commit);
    expect(git(base, "branch", "--show-current")).toBe("feat/eval");
    expect(git(base, "rev-parse", "main")).toBe(git(base, "rev-parse", "HEAD"));
    for (const stripped of [".claude", ".agents", "CLAUDE.md", "AGENTS.md"]) {
      expect(existsSync(join(base, stripped))).toBe(false);
    }
    expect(git(base, "show", "HEAD:src/app.ts")).toBe("export const a = 1;");
    expect(git(base, "status", "--porcelain")).toBe("");
    expect(installed).toEqual([base]);
  });

  it("reuses a prepared base for the same commit", () => {
    const { url, commit } = upstream();
    const cache = temp();
    let installs = 0;
    const first = prepareFixture({ repository: url, commit }, cache, { install: () => installs++ });
    const second = prepareFixture({ repository: url, commit }, cache, {
      install: () => installs++,
    });
    expect(second).toBe(first);
    expect(installs).toBe(1);
  });

  it("refuses when the fetched HEAD is not the pinned commit, printing both", () => {
    const { url } = upstream();
    const error = (() => {
      try {
        prepareFixture({ repository: url, commit: "main" }, temp());
      } catch (caught) {
        return caught;
      }
      return undefined;
    })();
    expect(error).toBeInstanceOf(FixtureMismatch);
    expect(String(error)).toMatch(/pinned main/);
    expect(String(error)).toMatch(/fetched [0-9a-f]{40}/);
  });
});

describe("freshCopy", () => {
  it("gives each run the base tree without a previous run's commits or files", () => {
    const { url, commit } = upstream();
    const base = prepareFixture({ repository: url, commit }, temp());
    const work = join(temp(), "work");
    freshCopy(base, work);
    writeFileSync(join(work, "run1.txt"), "x\n");
    git(work, "add", "run1.txt");
    git(work, "commit", "-q", "-m", "run 1");
    freshCopy(base, work);
    expect(existsSync(join(work, "run1.txt"))).toBe(false);
    expect(git(work, "rev-parse", "HEAD")).toBe(git(base, "rev-parse", "HEAD"));
  });
});

describe("npmCi", () => {
  it("runs npm ci in the directory without pnpm's npm_config_ settings", () => {
    const bin = temp();
    const work = temp();
    // A stand-in npm that records its arguments and environment.
    writeFileSync(join(bin, "npm"), '#!/bin/sh\necho "$@" > args.txt\nenv > env.txt\n', {
      mode: 0o755,
    });
    npmCi(work, {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      npm_config_verify_deps_before_run: "false",
      NPM_CONFIG_GLOBALCONFIG: "/x",
      KEEP_ME: "1",
    });
    expect(readFileSync(join(work, "args.txt"), "utf8").trim()).toBe("ci --no-audit --no-fund");
    const env = readFileSync(join(work, "env.txt"), "utf8");
    expect(env).toContain("KEEP_ME=1");
    expect(env.toLowerCase()).not.toContain("npm_config_verify_deps_before_run");
    expect(env.toLowerCase()).not.toContain("npm_config_globalconfig");
  });
});
