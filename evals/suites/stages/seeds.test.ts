import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BUNDLE, bdkNext } from "../execute-ab/seed.ts";
import { runSeed } from "./seeds.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" }).trim();
}

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-stages-seed-"));
  dirs.push(dir);
  return dir;
}

/** A stand-in for the prepared fixture base on `feat/eval`. */
function base(): string {
  const dir = temp();
  git(dir, "init", "-q", "-b", "feat/eval");
  git(dir, "config", "user.name", "BDK Eval");
  git(dir, "config", "user.email", "eval@bdk.invalid");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/app.ts"), "export const a = 1;\n");
  git(dir, "add", "--all");
  git(dir, "commit", "-q", "-m", "eval base");
  return dir;
}

describe("runSeed", () => {
  it("audit-csv leaves part 01 of a tiny Change next, flat, with part 02 waiting on it", () => {
    const dir = base();
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("audit-csv", dir, kernel);
    expect(bdkNext(dir, kernel)).toMatchObject({
      artifact: { id: "execute-part:01", state: "ready" },
      wave: [{ part: "01", started: false, tickets: [], mode: "flat" }],
    });
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("two-independent-parts leaves a large Change with both parts in one tree wave", () => {
    const dir = base();
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("two-independent-parts", dir, kernel);
    expect(bdkNext(dir, kernel)).toMatchObject({
      stage: "plan",
      artifact: { id: "execute-part:01", state: "ready" },
      wave: [
        { part: "01", started: false, tickets: [], mode: "tree" },
        { part: "02", started: false, tickets: [], mode: "tree" },
      ],
    });
    expect(git(dir, "status", "--porcelain")).toBe("");
  });
});
