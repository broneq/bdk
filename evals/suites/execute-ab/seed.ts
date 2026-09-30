// The execute task and its encodings (design D-4): the task is written once
// as v3 plan parts under `task/`; the v3 seed opens a Change with kernel
// commands and marks the plan done, the v2 seed renders the same tasks as a
// v2.7.0 plan file. Both seeds also commit the project settings a user would
// have after setup, with the same test and lint commands.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { REPO_ROOT } from "../../harness/paths.ts";

export const TASK_DIR = fileURLToPath(new URL("./task", import.meta.url));
export const BUNDLE = join(REPO_ROOT, "dist/bdk.mjs");
export const V2_PLAN = ".bdk/plans/2026-09-28-1200-audit-csv-export.md";

interface PlanTask {
  readonly id: string;
  readonly title: string;
  /** The task's text between its heading and `**Files:**`. */
  readonly description: string;
  readonly files: readonly string[];
  readonly testCases: readonly string[];
}

interface PlanPart {
  readonly id: string;
  readonly file: string;
  readonly source: string;
  readonly doNotTouch: readonly string[];
  readonly dependsOn: readonly string[];
  readonly tasks: readonly PlanTask[];
}

export interface ExecuteTask {
  readonly intent: string;
  readonly parts: readonly PlanPart[];
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

function listAfter(section: string, label: string): string[] {
  const start = section.indexOf(`**${label}:**`);
  if (start < 0) return [];
  const lines = section.slice(start).split("\n").slice(1);
  const items: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) items.push(line.slice(2).trim());
    else if (line.trim() !== "" || items.length > 0) {
      if (line.trim() === "") continue;
      break;
    }
  }
  return items;
}

function parseTasks(body: string): PlanTask[] {
  const sections = body.split(/^(?=## \d{2}-\d+ )/m).filter((section) => section.startsWith("## "));
  return sections.map((section) => {
    const heading = /^## (\d{2}-\d+) (.+)$/m.exec(section);
    if (heading === null) throw new Error(`task heading not understood: ${section.slice(0, 40)}`);
    const text = section.slice(heading[0].length);
    return {
      id: heading[1] ?? "",
      title: heading[2] ?? "",
      description: text.slice(0, text.indexOf("**Files:**")).trim(),
      files: listAfter(text, "Files").map((item) => item.replaceAll("`", "")),
      testCases: listAfter(text, "Test cases"),
    };
  });
}

export function readTask(dir: string): ExecuteTask {
  const partsDir = join(dir, "parts");
  const parts = readdirSync(partsDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((file): PlanPart => {
      const source = readFileSync(join(partsDir, file), "utf8");
      const match = FRONTMATTER.exec(source);
      if (match === null) throw new Error(`${file} has no frontmatter`);
      const data = parse(match[1] ?? "") as {
        id: string;
        "do-not-touch": string[];
        "depends-on": string[];
      };
      return {
        id: data.id,
        file,
        source,
        doNotTouch: data["do-not-touch"],
        dependsOn: data["depends-on"],
        tasks: parseTasks(source.slice(match[0].length)),
      };
    });
  return { intent: readFileSync(join(dir, "intent.md"), "utf8").trim(), parts };
}

/** The v2.7.0 plan of the same tasks (`skills/create-plan/references/plan-template.md` at that tag). */
export function v2Plan(task: ExecuteTask): string {
  const tasks = task.parts.flatMap((part) => part.tasks.map((entry) => ({ part, task: entry })));
  const number = new Map(tasks.map((entry, index) => [entry.task.id, index + 1]));
  // A task waits for the previous task of its part when they share a file,
  // and the first task of a part for the last task of the parts it depends on.
  const dependsOn = tasks.map(({ part, task: entry }, index) => {
    const previous = tasks[index - 1];
    if (previous?.part === part) {
      return previous.task.files.some((file) => entry.files.includes(file))
        ? [previous.task.id]
        : [];
    }
    return part.dependsOn.flatMap((id) => {
      const last = task.parts.find((candidate) => candidate.id === id)?.tasks.at(-1);
      return last === undefined ? [] : [last.id];
    });
  });
  const waves: number[] = [];
  dependsOn.forEach((deps, index) => {
    waves[index] = Math.max(0, ...deps.map((id) => (waves[(number.get(id) ?? 1) - 1] ?? 0) + 1));
  });
  const doNotTouch = [...new Set(task.parts.flatMap((part) => part.doNotTouch))];
  const lines = [
    `# Plan: ${task.intent.split(":")[0] ?? task.intent}`,
    "",
    "**Created:** 2026-09-28",
    "**Status:** Ready for implementation",
    `**Goal:** ${task.intent}`,
    "**Architecture:** Pure CSV helpers in `src/operator/auditCsv.ts`, used by an export button on the operator audit page.",
    "**Complexity:** LOW",
    "",
    "---",
    "",
    "## Context",
    "",
    task.intent,
    "",
    "---",
    "",
    "## Constraints (project-wide — apply to every task below)",
    "",
    `- Do not touch ${doNotTouch.map((glob) => `\`${glob}\``).join(", ")}.`,
    "",
    "---",
    "",
    "## Implementation Tasks",
    "",
  ];
  tasks.forEach(({ task: entry }, index) => {
    const deps = dependsOn[index] ?? [];
    lines.push(
      `### Task ${String(index + 1)}: ${entry.title}`,
      "",
      `**Depends on:** ${deps.length === 0 ? "none" : deps.map((id) => `T${String(number.get(id))}`).join(", ")}`,
      "",
      "**Files:**",
      "",
      ...entry.files.map((file) => `- \`${file}\``),
      "",
      entry.description,
      "",
      "**Test cases:**",
      "",
      ...entry.testCases.map((item) => `- ${item}`),
      "",
      "---",
      "",
    );
  });
  lines.push("## Execution Waves", "");
  const waveCount = Math.max(...waves) + 1;
  for (let wave = 0; wave < waveCount; wave++) {
    const members = tasks
      .filter((_, index) => waves[index] === wave)
      .map(({ task: entry }) => `T${String(number.get(entry.id))}`);
    const after = wave === 0 ? "no dependencies" : `depends on Wave ${String(wave)}`;
    lines.push(`- **Wave ${String(wave + 1)}** (${after}): ${members.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

/** The same test and lint commands in both layouts (`vitest related` needs absolute paths in this fixture). */
const V3_SETTINGS = `tools:
  test:
    - id: vitest
      tier: fast
      command: npx vitest run
      scoped: npx vitest run {files}
  lint:
    - id: eslint
      tier: lint
      command: npx eslint .
      scoped: npx eslint {files}
    - id: tsc
      tier: typecheck
      command: npx tsc -b --pretty false
`;

const V2_SETTINGS = {
  languages: ["typescript", "react"],
  "test-tools": [
    { type: "vitest", tier: "fast", command: "npx vitest run", scoped: "npx vitest run {files}" },
  ],
  "lint-tools": [
    { type: "eslint", tier: "lint", command: "npx eslint .", scoped: "npx eslint {files}" },
    { type: "tsc", tier: "typecheck", command: "npx tsc -b --pretty false" },
  ],
};

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(dir: string, ...args: string[]): void {
  execFileSync("git", args, { cwd: dir, env: ENV, stdio: "pipe" });
}

/** The kernel the seed calls: an arm seeds with its own plugin copy's bundle. */
export interface Kernel {
  readonly bundle: string;
  /** `XDG_CONFIG_HOME` of the kernel calls; the process's own when absent. */
  readonly configHome?: string;
}

const REPO_KERNEL: Kernel = { bundle: BUNDLE };

function bdk(dir: string, kernel: Kernel, ...args: string[]): string {
  const env =
    kernel.configHome === undefined ? ENV : { ...ENV, XDG_CONFIG_HOME: kernel.configHome };
  return execFileSync("node", [kernel.bundle, ...args], {
    cwd: dir,
    env,
    encoding: "utf8",
    stdio: "pipe",
  });
}

export function bdkNext(dir: string, kernel: Kernel = REPO_KERNEL): unknown {
  return JSON.parse(bdk(dir, kernel, "next", "--json"));
}

/** A Change at the end of its plan stage: `/bdk:execute` is the user's next command. */
export function seedV3(dir: string, task: ExecuteTask, kernel: Kernel = REPO_KERNEL): void {
  mkdirSync(join(dir, ".bdk"), { recursive: true });
  writeFileSync(join(dir, ".bdk/settings.yaml"), V3_SETTINGS);
  bdk(dir, kernel, "doctor", "--fix", "--json");
  git(dir, "add", ".bdk/settings.yaml");
  git(dir, "commit", "-q", "-m", "chore(bdk): project settings");
  const created = JSON.parse(
    bdk(
      dir,
      kernel,
      "change",
      "new",
      task.intent.split(":")[0] ?? task.intent,
      "--profile",
      "tiny",
      "--reason",
      "eval seed",
      "--json",
    ),
  ) as { change: string };
  const partsDir = join(dir, ".bdk/changes", created.change, "plan/parts");
  mkdirSync(partsDir, { recursive: true });
  for (const part of task.parts) writeFileSync(join(partsDir, part.file), part.source);
  bdk(dir, kernel, "done", "plan", "--json");
  bdk(dir, kernel, "change", "checkpoint", "--json");
  // The kernel's own .gitignore lines from `change new`, committed as a user would.
  git(dir, "add", ".gitignore");
  git(dir, "commit", "-q", "-m", "chore(bdk): ignore machine state");
}

/** The v2 executor's groups are the plan's execution waves. */
export function v2Groups(task: ExecuteTask): number {
  return v2Plan(task).match(/^- \*\*Wave \d+\*\*/gm)?.length ?? 0;
}

export function seedV2(dir: string, task: ExecuteTask): void {
  mkdirSync(join(dir, ".bdk/plans"), { recursive: true });
  writeFileSync(join(dir, ".bdk/settings.json"), `${JSON.stringify(V2_SETTINGS, null, 2)}\n`);
  writeFileSync(join(dir, V2_PLAN), v2Plan(task));
  git(dir, "add", ".bdk");
  git(dir, "commit", "-q", "-m", "chore(bdk): project settings and plan");
}
