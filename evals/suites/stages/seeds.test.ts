import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { BUNDLE, bdkNext } from "../execute-ab/seed.ts";
import { runSeed, sectionsFor } from "./seeds.ts";
import { writePreimages } from "./testing.ts";

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

/** The base with the files the seed's task patches change, as their hunks' preimages. */
function baseFor(...patches: string[]): string {
  const dir = base();
  writePreimages(
    dir,
    patches.map((patch) => readFileSync(patch, "utf8")),
  );
  git(dir, "add", "--all");
  git(dir, "commit", "-q", "-m", "fixture files");
  return dir;
}

const TASKS = join(import.meta.dirname, "seeds", "executed-two-parts", "tasks");

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

  it("executed leaves a tiny Change with part 01 committed and the review stage next", () => {
    const dir = base();
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("executed", dir, kernel);
    expect(bdkNext(dir, kernel)).toMatchObject({ command: "/bdk:cr" });
    // The gate runner of /bdk:cr records tests-full and lint-full, which review requires.
    expect(bdkJson(dir, kernel, ["explain", "tests-full"])).toMatchObject({ state: "ready" });
    expect(readFileSync(join(dir, "src/app-name.ts"), "utf8")).toContain("APP_NAME");
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("executed-blocker delivers the task without the export it names", () => {
    const dir = base();
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("executed-blocker", dir, kernel);
    expect(bdkJson(dir, kernel, ["explain", "tests-full"])).toMatchObject({ state: "ready" });
    expect(readFileSync(join(dir, "src/app-name.ts"), "utf8")).not.toContain("APP_NAME");
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("executed-two-parts commits both parts from their patches, 02 after 01", () => {
    const dir = baseFor(join(TASKS, "01-1.patch"), join(TASKS, "02-1.patch"));
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("executed-two-parts", dir, kernel);
    expect(bdkNext(dir, kernel)).toMatchObject({ command: "/bdk:cr" });
    const tasks = git(dir, "log", "--format=%(trailers:key=BDK-Task,valueonly)", "--reverse")
      .split("\n")
      .filter(Boolean);
    expect(tasks).toStrictEqual(["01-1", "02-1"]);
    // The binary snapshot of task 02-1 is committed with it, and the spec delta is done.
    const snapshot = "src/ui/__snapshots__/load-error.png";
    expect(
      git(dir, "log", "--format=%(trailers:key=BDK-Task,valueonly)", "--", snapshot).trim(),
    ).toBe("02-1");
    expect(bdkJson(dir, kernel, ["explain", "spec-delta"])).toMatchObject({ state: "done" });
    expect(readFileSync(join(dir, "src/api/http.ts"), "utf8")).toContain("isProblemDetails");
    expect(readFileSync(join(dir, "src/ui/asyncState.ts"), "utf8")).toContain("getLoadMessage");
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("shared-lockfile leaves two disjoint parts in one wave, part 02 in a worktree", () => {
    const dir = base();
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("shared-lockfile", dir, kernel);
    expect(bdkNext(dir, kernel)).toMatchObject({
      command: "/bdk:execute",
      artifact: { id: "execute-part:01", state: "ready" },
      wave: [
        { part: "01", started: false, isolation: "shared" },
        { part: "02", started: false, isolation: "worktree" },
      ],
    });
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("shared-lockfile-unisolated leaves both parts shared and plan-verify next", () => {
    const dir = base();
    const kernel = { bundle: BUNDLE, configHome: temp() };
    runSeed("shared-lockfile-unisolated", dir, kernel);
    expect(bdkNext(dir, kernel)).toMatchObject({ artifact: { id: "plan-verify" } });
    const { items } = bdkJson(dir, kernel, ["part", "list"]) as { items: { part: string }[] };
    expect(items.map((item) => item.part)).toStrictEqual(["01", "02"]);
    const [change] = readdirSync(join(dir, ".bdk", "changes")).filter((name) =>
      name.startsWith("20"),
    );
    const part = readFileSync(
      join(dir, ".bdk", "changes", change ?? "", "plan/parts/02-part.md"),
      "utf8",
    );
    expect(part).not.toMatch(/^isolation/m);
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
    // change close refuses a live finding, observation or blocker without a disposition (T42).
    const ledger = bdkJson(dir, kernel, ["log", "list"]) as {
      items: { type: string; status: string; disposition?: string }[];
    };
    const undecided = ledger.items.filter(
      (entry) =>
        ["finding", "observation", "blocker"].includes(entry.type) &&
        entry.status !== "resolved" &&
        entry.disposition === undefined,
    );
    expect(undecided).toStrictEqual([]);
    expect(git(dir, "log", "--format=%B")).toContain("BDK-Task: 01-1");
    expect(git(dir, "status", "--porcelain")).toBe("");
  });
});

describe("sectionsFor", () => {
  const patch = [
    "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n",
    "diff --git a/c.ts b/c.ts\n--- a/c.ts\n+++ b/c.ts\n@@ -1 +1 @@\n-c\n+d\n",
  ].join("");

  it("keeps the sections of the named files only", () => {
    expect(sectionsFor(patch, ["c.ts"])).toBe(
      "diff --git a/c.ts b/c.ts\n--- a/c.ts\n+++ b/c.ts\n@@ -1 +1 @@\n-c\n+d\n",
    );
    expect(sectionsFor(patch, ["a.ts", "c.ts"])).toBe(patch);
    expect(sectionsFor(patch, ["x.ts"])).toBe("");
  });

  it("keeps a binary section of a named file, which has no +++ line", () => {
    const binary =
      "diff --git a/s/a.png b/s/a.png\nnew file mode 100644\nindex 0..1\nGIT binary patch\nliteral 1\nzc\n\n";
    expect(sectionsFor(patch + binary, ["s/a.png"])).toBe(binary);
  });

  it("refuses defects for a seed without task patches", () => {
    expect(() => {
      runSeed("executed", "/nowhere", { bundle: BUNDLE }, patch);
    }).toThrow(/the seed executed delivers no task patch to carry defects/);
  });
});
