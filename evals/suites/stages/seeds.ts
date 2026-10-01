// The seeds of the stages suite (design D12 of v3-t41-execute): a Change a
// case starts from that shell lines in `prepare` would express badly, built
// through the kernel the run uses, as a user's sessions would have left it.
// `audit-csv` is the T40 execute task on a tiny Change; `two-independent-parts`
// is a large Change whose plan has two parts without dependencies.
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TASK_DIR, readTask, seedV3 } from "../execute-ab/seed.ts";
import type { Kernel } from "../execute-ab/seed.ts";

export const SEEDS = ["audit-csv", "two-independent-parts"] as const;

export type SeedName = (typeof SEEDS)[number];

export function isSeed(value: unknown): value is SeedName {
  return (SEEDS as readonly unknown[]).includes(value);
}

const TWO_PARTS = fileURLToPath(new URL("./seeds/two-independent-parts", import.meta.url));

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

/** One passing verifier round on `node`, as `/bdk:verify-design` or `/bdk:verify-plan` records it. */
function verified(dir: string, kernel: Kernel, node: "design-verify" | "plan-verify"): void {
  const ticket = field(run(dir, kernel, ["attempt", "open", "verifier", node]), "ticket");
  const report = field(run(dir, kernel, ["dispatch", "build", node, "verifier", ticket]), "report");
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
  // The kernel's own .gitignore lines from `change new`, committed as a user would.
  execFileSync("git", ["add", ".gitignore"], { cwd: dir, env: ENV, stdio: "pipe" });
  const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
    cwd: dir,
    env: ENV,
    encoding: "utf8",
  });
  if (staged.trim() !== "") {
    execFileSync("git", ["commit", "-q", "-m", "chore(bdk): ignore machine state"], {
      cwd: dir,
      env: ENV,
      stdio: "pipe",
    });
  }
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
  }
}
