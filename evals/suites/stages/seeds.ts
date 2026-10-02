// The seeds of the stages suite (design D12 of v3-t41-execute): a Change a
// case starts from that shell lines in `prepare` would express badly, built
// through the kernel the run uses, as a user's sessions would have left it.
// `audit-csv` is the T40 execute task on a tiny Change; `two-independent-parts`
// is a large Change whose plan has two parts without dependencies; `reviewed`
// is a tiny Change executed and reviewed, waiting at `gate:review` (T41).
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TASK_DIR, readTask, seedV3 } from "../execute-ab/seed.ts";
import type { Kernel } from "../execute-ab/seed.ts";

export const SEEDS = ["audit-csv", "two-independent-parts", "reviewed"] as const;

export type SeedName = (typeof SEEDS)[number];

export function isSeed(value: unknown): value is SeedName {
  return (SEEDS as readonly unknown[]).includes(value);
}

const TWO_PARTS = fileURLToPath(new URL("./seeds/two-independent-parts", import.meta.url));
const REVIEWED = fileURLToPath(new URL("./seeds/reviewed", import.meta.url));

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function envOf(kernel: Kernel): NodeJS.ProcessEnv {
  return kernel.configHome === undefined ? ENV : { ...ENV, XDG_CONFIG_HOME: kernel.configHome };
}

function run(dir: string, kernel: Kernel, args: readonly string[], stdin?: string): unknown {
  const stdout = execFileSync("node", [kernel.bundle, ...args, "--json"], {
    cwd: dir,
    env: envOf(kernel),
    encoding: "utf8",
    stdio: "pipe",
    ...(stdin === undefined ? {} : { input: stdin }),
  });
  return stdout.trim() === "" ? undefined : (JSON.parse(stdout) as unknown);
}

function field(value: unknown, name: string): string {
  const found = (value as Record<string, unknown> | undefined)?.[name];
  if (typeof found !== "string") throw new Error(`the kernel answer has no ${name}`);
  return found;
}

const PASS = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nPASS\n";

function git(dir: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: dir, env: ENV, encoding: "utf8", stdio: "pipe" });
}

/** The kernel's own .gitignore lines from `change new`, committed as a user would. */
function commitIgnore(dir: string): void {
  git(dir, "add", ".gitignore");
  if (git(dir, "diff", "--cached", "--name-only").trim() !== "") {
    git(dir, "commit", "-q", "-m", "chore(bdk): ignore machine state");
  }
}

/** One passing verifier round on `node`, as `/bdk:verify-design`, `/bdk:verify-plan` or `/bdk:cr` records it. */
function verified(
  dir: string,
  kernel: Kernel,
  node: "design-verify" | "plan-verify" | "review",
): void {
  const role = node === "review" ? "reviewer" : "verifier";
  const ticket = field(run(dir, kernel, ["attempt", "open", "verifier", node]), "ticket");
  const report = field(run(dir, kernel, ["dispatch", "build", node, role, ticket]), "report");
  run(dir, kernel, ["log", "ingest", "--ticket", ticket], PASS);
  run(dir, kernel, ["log", "add", "report", `${node} passed`, "--ref", node, "--ticket", ticket]);
  run(dir, kernel, ["attempt", "close", ticket, "ok", "--envelope", report]);
  run(dir, kernel, ["done", node]);
}

/** The user typing `/bdk:plan`: the prompt-expansion hook passes `gate:design`. */
function typedPlan(dir: string, kernel: Kernel): void {
  const payload = {
    session_id: "seed",
    cwd: dir,
    hook_event_name: "UserPromptExpansion",
    expansion_type: "slash_command",
    command_name: "bdk:plan",
    command_args: "",
    command_source: "plugin",
    prompt: "/bdk:plan",
  };
  execFileSync("node", [kernel.bundle, "hooks", "prompt-expansion"], {
    cwd: dir,
    env: envOf(kernel),
    input: JSON.stringify(payload),
    stdio: "pipe",
  });
}

/** A large Change at the end of its plan stage, parts 01 (`src/ui/format.ts`) and 02 (`src/api/http.ts`) independent. */
function twoIndependentParts(dir: string, kernel: Kernel): void {
  const intent = readFileSync(join(TWO_PARTS, "intent.md"), "utf8").trim();
  const change = field(
    run(dir, kernel, ["change", "new", intent, "--profile", "large", "--reason", "eval seed"]),
    "change",
  );
  const changeDir = join(dir, ".bdk", "changes", change);
  const copy = (path: string) => {
    cpSync(join(TWO_PARTS, path), join(changeDir, path), { recursive: true });
  };
  copy("design");
  run(dir, kernel, ["done", "design-parts"]);
  run(dir, kernel, ["done", "design-index"]);
  copy("architecture.md");
  run(dir, kernel, ["done", "architecture"]);
  verified(dir, kernel, "design-verify");
  typedPlan(dir, kernel);
  copy("plan");
  run(dir, kernel, ["done", "plan"]);
  verified(dir, kernel, "plan-verify");
  run(dir, kernel, ["change", "checkpoint"]);
  commitIgnore(dir);
}

/** Task 01-1 delivered as `/bdk:execute` runs it: implementer, steps, ticket closed, commit. */
function deliveredTask(dir: string, kernel: Kernel): void {
  const ticket = field(run(dir, kernel, ["attempt", "open", "task-redispatch", "01-1"]), "ticket");
  const report = field(
    run(dir, kernel, ["dispatch", "build", "01-1", "implementer", ticket]),
    "report",
  );
  run(dir, kernel, ["rules", "show", "--ticket", ticket]);
  writeFileSync(join(dir, "src/app-name.ts"), 'export const APP_NAME = "Operator";\n');
  run(
    dir,
    kernel,
    ["log", "ingest", "--ticket", ticket],
    "---\nstatus: done\nfiles: [src/app-name.ts]\nentries: []\nevidence: []\n---\nAdded.\n",
  );
  run(dir, kernel, ["dispatch", "build", "01-1", "simplifier", ticket]);
  run(dir, kernel, ["log", "ingest", "--ticket", ticket], PASS);
  run(dir, kernel, ["dispatch", "build", "01-1", "runner", ticket]);
  for (const kind of ["tests-scoped", "lint"]) {
    const result = `.bdk/.machine/${kind}-${ticket}.json`;
    writeFileSync(join(dir, result), '{"failed":0}\n');
    run(dir, kernel, [
      "evidence",
      "record",
      kind,
      result,
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      "/failed",
    ]);
  }
  run(dir, kernel, ["attempt", "close", ticket, "ok", "--envelope", report]);
  run(dir, kernel, ["commit", "01-1"]);
}

/** A tiny Change with part 01 committed, its review passed and `gate:review` ready. */
function reviewed(dir: string, kernel: Kernel): void {
  const intent = readFileSync(join(REVIEWED, "intent.md"), "utf8").trim();
  const change = field(
    run(dir, kernel, ["change", "new", intent, "--profile", "tiny", "--reason", "eval seed"]),
    "change",
  );
  // Before the review: the review's input is the committed code tree, .gitignore included.
  commitIgnore(dir);
  cpSync(join(REVIEWED, "plan"), join(dir, ".bdk", "changes", change, "plan"), { recursive: true });
  run(dir, kernel, ["done", "plan"]);
  run(dir, kernel, ["part", "start", "01"]);
  deliveredTask(dir, kernel);
  run(dir, kernel, ["part", "done", "01"]);
  verified(dir, kernel, "review");
  run(dir, kernel, ["change", "checkpoint"]);
}

/** Runs the seed in `dir`, before the case's `prepare` lines. */
export function runSeed(name: SeedName, dir: string, kernel: Kernel): void {
  switch (name) {
    case "audit-csv":
      seedV3(dir, readTask(TASK_DIR), kernel);
      return;
    case "two-independent-parts":
      twoIndependentParts(dir, kernel);
      return;
    case "reviewed":
      reviewed(dir, kernel);
      return;
  }
}
