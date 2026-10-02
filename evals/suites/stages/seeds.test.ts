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
function bdkJson(dir: string, kernel: { bundle: string; configHome: string }, args: string[]) {
  const stdout = execFileSync("node", [kernel.bundle, ...args, "--json"], {
    cwd: dir,
    env: { ...GIT_ENV, XDG_CONFIG_HOME: kernel.configHome },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as unknown;
}

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

// Each seed spawns about twenty kernel and git processes: seconds, more on a loaded CI runner.
describe("runSeed", { timeout: 60_000 }, () => {
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
      command: "/bdk:execute",
      artifact: { id: "execute-part:01", state: "ready" },
      wave: [
        { part: "01", started: false, tickets: [], mode: "tree" },
        { part: "02", started: false, tickets: [], mode: "tree" },
      ],
    });
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("reviewed leaves a tiny Change with its review done and gate:review ready", () => {
    const dir = base();
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("reviewed", dir, kernel);
    expect(bdkNext(dir, kernel)).toMatchObject({
      waiting: "gate",
      gates: [{ gate: "gate:review", ready: true, done: false, command: "/bdk:close" }],
    });
    expect(bdkJson(dir, kernel, ["explain", "review"])).toMatchObject({ state: "done" });
    const { items } = bdkJson(dir, kernel, ["attempt", "list"]) as {
      items: { outcome?: string }[];
    };
    expect(items.map((item) => item.outcome)).toStrictEqual(["ok", "ok"]);
    expect(git(dir, "log", "--format=%B")).toContain("BDK-Task: 01-1");
    expect(git(dir, "status", "--porcelain")).toBe("");
  });
});
