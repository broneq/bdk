// The seeds of the stages suite (design D12 of v3-t41-execute): a Change a
// case starts from that shell lines in `prepare` would express badly, built
// through the kernel the run uses, as a user's sessions would have left it.
// `audit-csv` is the T40 execute task on a tiny Change; `two-independent-parts`
// is a large Change whose plan has two parts without dependencies; `reviewed`
// is a tiny Change executed and reviewed, waiting at `gate:review` (T41).
// `executed` is that Change before its review, and `executed-blocker` the same
// with the task delivered without the export it names; `executed-two-parts` is
// a Change with two dependent parts delivered, its spec delta done and a
// binary snapshot among its files, the base of `review-models` (T42, #158),
// which passes a defects patch: each task then delivers its files with the
// defects in them, as an implementer that made those mistakes would have.
// `shared-lockfile` is a large Change whose two disjoint parts both add a
// dependency with npm install, part 02 in a worktree (T45);
// `shared-lockfile-unisolated` is its plan with both parts shared, done and
// not yet verified.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TASK_DIR, readTask, seedV3 } from "../execute-ab/seed.ts";
import type { Kernel } from "../execute-ab/seed.ts";

export const SEEDS = [
  "audit-csv",
  "two-independent-parts",
  "executed",
  "executed-blocker",
  "reviewed",
  "executed-two-parts",
  "shared-lockfile",
  "shared-lockfile-unisolated",
] as const;

export type SeedName = (typeof SEEDS)[number];

export function isSeed(value: unknown): value is SeedName {
  return (SEEDS as readonly unknown[]).includes(value);
}

const TWO_PARTS = fileURLToPath(new URL("./seeds/two-independent-parts", import.meta.url));
const REVIEWED = fileURLToPath(new URL("./seeds/reviewed", import.meta.url));
const TWO_PARTS_EXECUTED = fileURLToPath(new URL("./seeds/executed-two-parts", import.meta.url));
const SHARED_LOCKFILE = fileURLToPath(new URL("./seeds/shared-lockfile", import.meta.url));

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

/**
 * The kernel's own .gitignore lines and formatter guard from `change new`,
 * committed as a user would. A kernel older than the guard writes none.
 */
function commitIgnore(dir: string): void {
  git(dir, "add", ".gitignore");
  if (existsSync(join(dir, ".bdk/.prettierrc"))) git(dir, "add", ".bdk/.prettierrc");
  if (git(dir, "diff", "--cached", "--name-only").trim() !== "") {
    git(dir, "commit", "-q", "-m", "chore(bdk): ignore machine state");
  }
}

/**
 * The fixture's test and lint commands, committed before `change new`
 * refuses an unset tool group (T49); a case's own `config set` lines replace
 * them by id.
 */
function projectTools(dir: string, kernel: Kernel): void {
  run(dir, kernel, ["config", "set", "tools.test.vitest", "{tier: fast, command: npx vitest run}"]);
  run(dir, kernel, ["config", "set", "tools.lint.eslint", "{tier: lint, command: npx eslint .}"]);
  git(dir, "add", ".bdk/settings.yaml");
  git(dir, "commit", "-q", "-m", "chore(bdk): project settings");
}

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

interface LargeOptions {
  /** Run the passing `plan-verify` round; without it the plan is done and not verified. */
  readonly verifyPlan: boolean;
  /** Rewrites a copied plan part, given its file name and text. */
  readonly part?: (name: string, text: string) => string;
}

/** A large Change from the files of `source`, at the end of its plan stage. */
function largeChange(dir: string, kernel: Kernel, source: string, options: LargeOptions): void {
  const intent = readFileSync(join(source, "intent.md"), "utf8").trim();
  projectTools(dir, kernel);
  const change = field(
    run(dir, kernel, ["change", "new", intent, "--profile", "large", "--reason", "eval seed"]),
    "change",
  );
  const changeDir = join(dir, ".bdk", "changes", change);
  const copy = (path: string) => {
    cpSync(join(source, path), join(changeDir, path), { recursive: true });
  };
  copy("design");
  run(dir, kernel, ["done", "design-parts"]);
  run(dir, kernel, ["done", "design-index"]);
  copy("architecture.md");
  run(dir, kernel, ["done", "architecture"]);
  verified(dir, kernel, "design-verify");
  typedPlan(dir, kernel);
  copy("plan");
  const rewrite = options.part;
  if (rewrite !== undefined) {
    const parts = join(changeDir, "plan", "parts");
    for (const name of readdirSync(parts)) {
      const path = join(parts, name);
      writeFileSync(path, rewrite(name, readFileSync(path, "utf8")));
    }
  }
  run(dir, kernel, ["done", "plan"]);
  if (options.verifyPlan) verified(dir, kernel, "plan-verify");
  run(dir, kernel, ["change", "checkpoint"]);
  commitIgnore(dir);
}

/** Both parts `shared`: the isolation lines of part 02 dropped. */
function unisolated(_name: string, text: string): string {
  return text.replace(/^isolation(?:-reason)?: .*\n/gm, "");
}

/**
 * One task delivered as `/bdk:execute` runs it: implementer, steps, ticket
 * closed, commit. `deliver` writes the task's code and returns its paths.
 */
function deliveredTask(
  dir: string,
  kernel: Kernel,
  task: string,
  deliver: () => readonly string[],
): void {
  const ticket = field(run(dir, kernel, ["attempt", "open", "task-redispatch", task]), "ticket");
  const report = field(
    run(dir, kernel, ["dispatch", "build", task, "implementer", ticket]),
    "report",
  );
  run(dir, kernel, ["rules", "show", "--ticket", ticket]);
  const files = deliver();
  run(
    dir,
    kernel,
    ["log", "ingest", "--ticket", ticket],
    `---\nstatus: done\nfiles: [${files.join(", ")}]\nentries: []\nevidence: []\n---\nDelivered.\n`,
  );
  run(dir, kernel, ["dispatch", "build", task, "simplifier", ticket]);
  run(dir, kernel, ["log", "ingest", "--ticket", ticket], PASS);
  run(dir, kernel, ["dispatch", "build", task, "runner", ticket]);
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
  run(dir, kernel, ["commit", task]);
}

/**
 * The files a unified diff changes, by their `diff --git` lines, so a binary
 * section, which has no `+++ b/` line, counts too.
 */
function patchFiles(patch: string): string[] {
  return [...patch.matchAll(/^diff --git a\/\S+ b\/(.+)$/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

/** The sections of a unified diff that change one of `files`, or "" when none does. */
export function sectionsFor(patch: string, files: readonly string[]): string {
  const sections = patch.split(/^(?=diff --git )/m).filter((section) => section.trim() !== "");
  return sections
    .filter((section) => patchFiles(section).some((file) => files.includes(file)))
    .join("");
}

/**
 * A task's code from a patch in the seed directory, applied to the working
 * tree, then the sections of `defects` that change the same files.
 */
function patched(dir: string, patch: string, defects?: string): () => readonly string[] {
  return () => {
    git(dir, "apply", patch);
    const extra =
      defects === undefined ? "" : sectionsFor(defects, patchFiles(readFileSync(patch, "utf8")));
    if (extra !== "") {
      execFileSync("git", ["apply", "-"], { cwd: dir, env: ENV, input: extra, stdio: "pipe" });
    }
    // A file the patch adds is untracked, so `git diff` alone would miss it.
    return git(dir, "ls-files", "--modified", "--others", "--exclude-standard").trim().split("\n");
  };
}

/**
 * One clean `review-fix` round, as `/bdk:cr` records it (T42): the gate
 * runner's `tests-full` and `lint-full`, the merged report under `merge`, the
 * round closed and `review` done.
 */
function reviewRound(dir: string, kernel: Kernel, change: string): void {
  const ticket = field(run(dir, kernel, ["attempt", "open", "review-fix", change]), "ticket");
  run(dir, kernel, ["dispatch", "build", change, "runner", ticket, "--group", "gate"]);
  for (const kind of ["tests-full", "lint-full"]) {
    const result = `.bdk/.machine/${kind}-${ticket}.json`;
    writeFileSync(join(dir, result), '{"failed":0}\n');
    run(dir, kernel, [
      "evidence",
      "record",
      kind,
      result,
      "--ticket",
      `${ticket}@gate`,
      "--verdict",
      "pass",
      "--cite",
      "/failed",
    ]);
  }
  run(dir, kernel, ["log", "ingest", "--ticket", `${ticket}@merge`], PASS);
  run(dir, kernel, ["log", "add", "report", "review passed", "--ticket", `${ticket}@merge`]);
  run(dir, kernel, ["attempt", "close", ticket, "ok"]);
  run(dir, kernel, ["done", "review"]);
}

/**
 * The tiny `APP_NAME` Change with part 01 committed and no review yet;
 * `appName` is the delivered file, so a seed can deliver it wrong.
 */
function executedTiny(dir: string, kernel: Kernel, appName: string): string {
  const intent = readFileSync(join(REVIEWED, "intent.md"), "utf8").trim();
  projectTools(dir, kernel);
  const change = field(
    run(dir, kernel, ["change", "new", intent, "--profile", "tiny", "--reason", "eval seed"]),
    "change",
  );
  // Before the review: the review's input is the committed code tree, .gitignore included.
  commitIgnore(dir);
  cpSync(join(REVIEWED, "plan"), join(dir, ".bdk", "changes", change, "plan"), { recursive: true });
  run(dir, kernel, ["done", "plan"]);
  run(dir, kernel, ["part", "start", "01"]);
  deliveredTask(dir, kernel, "01-1", () => {
    writeFileSync(join(dir, "src/app-name.ts"), appName);
    return ["src/app-name.ts"];
  });
  run(dir, kernel, ["part", "done", "01"]);
  return change;
}

const APP_NAME = 'export const APP_NAME = "Operator";\n';

/** A tiny Change with part 01 committed, its review passed and `gate:review` ready. */
function reviewed(dir: string, kernel: Kernel): void {
  reviewRound(dir, kernel, executedTiny(dir, kernel, APP_NAME));
  run(dir, kernel, ["change", "checkpoint"]);
}

/**
 * A Change with parts 01 (`src/api/http.ts`) and 02 (`src/ui/asyncState.ts`,
 * depending on 01) delivered from the task patches and no review yet.
 */
function executedTwoParts(dir: string, kernel: Kernel, defects?: string): void {
  const intent = readFileSync(join(TWO_PARTS_EXECUTED, "intent.md"), "utf8").trim();
  projectTools(dir, kernel);
  const change = field(
    run(dir, kernel, ["change", "new", intent, "--profile", "tiny", "--reason", "eval seed"]),
    "change",
  );
  commitIgnore(dir);
  // The plan with the spec delta its parts name in `spec-impact`, which the
  // integration reviewer traces (#158).
  for (const path of ["plan", "spec-delta"]) {
    cpSync(join(TWO_PARTS_EXECUTED, path), join(dir, ".bdk", "changes", change, path), {
      recursive: true,
    });
  }
  run(dir, kernel, ["done", "plan"]);
  for (const [part, task] of [
    ["01", "01-1"],
    ["02", "02-1"],
  ] as const) {
    run(dir, kernel, ["part", "start", part]);
    deliveredTask(dir, kernel, task, patched(dir, taskPatch(task), defects));
    run(dir, kernel, ["part", "done", part]);
  }
  run(dir, kernel, ["done", "spec-delta"]);
  run(dir, kernel, ["change", "checkpoint"]);
}

function taskPatch(task: string): string {
  return join(TWO_PARTS_EXECUTED, "tasks", `${task}.patch`);
}

/** The task patches a seed applies, in order; a seed that writes its code itself has none. */
export function seedPatches(name: SeedName): string[] {
  return name === "executed-two-parts" ? ["01-1", "02-1"].map(taskPatch) : [];
}

/**
 * Runs the seed in `dir`, before the case's `prepare` lines. `defects` is a
 * unified diff the tasks deliver with their code; only a seed with task
 * patches takes one.
 */
export function runSeed(name: SeedName, dir: string, kernel: Kernel, defects?: string): void {
  if (defects !== undefined && seedPatches(name).length === 0) {
    throw new Error(`the seed ${name} delivers no task patch to carry defects`);
  }
  switch (name) {
    case "audit-csv":
      seedV3(dir, readTask(TASK_DIR), kernel);
      return;
    case "two-independent-parts":
      largeChange(dir, kernel, TWO_PARTS, { verifyPlan: true });
      return;
    case "shared-lockfile":
      largeChange(dir, kernel, SHARED_LOCKFILE, { verifyPlan: true });
      return;
    case "shared-lockfile-unisolated":
      largeChange(dir, kernel, SHARED_LOCKFILE, { verifyPlan: false, part: unisolated });
      return;
    case "executed":
      executedTiny(dir, kernel, APP_NAME);
      run(dir, kernel, ["change", "checkpoint"]);
      return;
    case "executed-blocker":
      // The task names the export APP_NAME; the delivery exports another name.
      executedTiny(dir, kernel, 'export const APP_TITLE = "Operator";\n');
      run(dir, kernel, ["change", "checkpoint"]);
      return;
    case "reviewed":
      reviewed(dir, kernel);
      return;
    case "executed-two-parts":
      executedTwoParts(dir, kernel, defects);
      return;
  }
}
