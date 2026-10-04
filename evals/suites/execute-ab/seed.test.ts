import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  BUNDLE,
  TASK_DIR,
  V2_PLAN,
  bdkNext,
  readTask,
  seedV2,
  seedV3,
  v2Groups,
  v2Plan,
} from "./seed.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" }).trim();
}

/** A stand-in for the prepared fixture base: `feat/eval` with `main` at the same commit. */
function base(): string {
  const dir = mkdtempSync(join(tmpdir(), "bdk-evals-seed-"));
  dirs.push(dir);
  git(dir, "init", "-q", "-b", "feat/eval");
  git(dir, "config", "user.name", "BDK Eval");
  git(dir, "config", "user.email", "eval@bdk.invalid");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/app.ts"), "export const a = 1;\n");
  git(dir, "add", "--all");
  git(dir, "commit", "-q", "-m", "eval base");
  git(dir, "branch", "main");
  return dir;
}

describe("readTask", () => {
  it("reads the intent and both parts with their tasks and files", () => {
    const task = readTask(TASK_DIR);
    expect(task.intent).toMatch(/Export CSV/);
    expect(task.parts.map((part) => part.id)).toEqual(["01", "02"]);
    expect(task.parts.flatMap((part) => part.tasks.map((entry) => entry.id))).toEqual([
      "01-1",
      "01-2",
      "02-1",
      "02-2",
    ]);
    expect(task.parts[1]?.tasks[0]?.files).toEqual([
      "src/operator/OperatorPage.tsx",
      "src/operator/OperatorPage.test.tsx",
      "src/i18n/messages.ts",
    ]);
    expect(task.parts[0]?.doNotTouch).toEqual(["src/api/**", "package.json", "package-lock.json"]);
  });
});

describe("v2Plan", () => {
  it("encodes the same four tasks as v2 tasks with a serial wave per task", () => {
    const plan = v2Plan(readTask(TASK_DIR));
    expect(
      [...plan.matchAll(/^### Task (\d): (.+)$/gm)].map(
        (match) => `${match[1] ?? ""} ${match[2] ?? ""}`,
      ),
    ).toEqual([
      "1 Audit rows as CSV text",
      "2 File name of the export",
      "3 Export CSV button",
      "4 Download the current page",
    ]);
    expect([...plan.matchAll(/^\*\*Depends on:\*\* (.+)$/gm)].map((match) => match[1])).toEqual([
      "none",
      "T1",
      "T2",
      "T3",
    ]);
    expect(plan).toContain("- **Wave 4** (depends on Wave 3): T4");
    expect(v2Groups(readTask(TASK_DIR))).toBe(4);
    expect(plan).toContain("**Test cases:**\n\n- header line only for no entries");
  });
});

// Each seed runs the kernel bundle several times: about 2 s alone, over 5 s
// beside another test run.
describe("seedV3", { timeout: 60_000 }, () => {
  it("leaves a committed Change whose next step is part 01 of the execute stage, the same on every seed", () => {
    const first = base();
    const second = base();
    // The second seed runs like an arm's: its own bundle and an empty config home.
    const kernel = { bundle: BUNDLE, configHome: base() };
    seedV3(first, readTask(TASK_DIR));
    seedV3(second, readTask(TASK_DIR), kernel);
    const next = bdkNext(first);
    expect(next).toMatchObject({
      stage: "plan",
      artifact: { id: "execute-part:01", state: "ready" },
    });
    expect(bdkNext(second, kernel)).toEqual(next);
    expect(git(first, "status", "--porcelain")).toBe("");
    expect(readFileSync(join(first, ".bdk/settings.yaml"), "utf8")).toContain(
      "scoped: npx vitest run {files}",
    );
  });
});

describe("seedV2", () => {
  it("commits the v2 settings and the plan at .bdk/plans/", () => {
    const dir = base();
    seedV2(dir, readTask(TASK_DIR));
    expect(readFileSync(join(dir, V2_PLAN), "utf8")).toBe(v2Plan(readTask(TASK_DIR)));
    const settings = JSON.parse(readFileSync(join(dir, ".bdk/settings.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(settings["test-tools"]).toEqual([
      { type: "vitest", tier: "fast", command: "npx vitest run", scoped: "npx vitest run {files}" },
    ]);
    expect(git(dir, "status", "--porcelain")).toBe("");
    expect(existsSync(join(dir, ".bdk/changes"))).toBe(false);
  });
});
