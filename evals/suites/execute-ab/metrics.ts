// Per-run metrics of the execute A/B suite (design D-7), computed from the
// state a session leaves in its working copy and from its tool calls, never
// from the orchestrator's own summary.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { parse } from "yaml";

import type { ToolCall } from "../../harness/hook.ts";

/** Runs a command in a directory and returns its exit code. */
export type Exec = (command: string, args: readonly string[], cwd: string) => number;

export interface AcceptanceChecks {
  /** The fixture's whole test suite, run before the hidden tests are copied in. */
  readonly suite: boolean;
  readonly hidden: boolean;
  readonly typecheck: boolean;
  /** Lint on the source files changed against the base; passes when none changed. */
  readonly lint: boolean;
}

/** The fixture base carries `main` at the eval base commit (`harness/fixture.ts`). */
const BASE_REF = "main";
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", stdio: "pipe" }).trim();
}

function lines(text: string): string[] {
  return text.split("\n").filter((line) => line !== "");
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

function changedSources(workDir: string): string[] {
  const changed = new Set([
    ...lines(git(workDir, "diff", "--name-only", BASE_REF)),
    ...lines(git(workDir, "ls-files", "--others", "--exclude-standard")),
  ]);
  return [...changed]
    .filter(
      (path) => SOURCE.test(path) && !path.startsWith(".bdk/") && existsSync(join(workDir, path)),
    )
    .sort();
}

export function acceptance(workDir: string, hiddenDir: string, exec: Exec): AcceptanceChecks {
  const changed = changedSources(workDir);
  const suite = exec("npx", ["vitest", "run"], workDir) === 0;
  const hiddenFiles = filesUnder(hiddenDir);
  cpSync(hiddenDir, workDir, { recursive: true });
  const hidden = exec("npx", ["vitest", "run", ...hiddenFiles], workDir) === 0;
  const typecheck = exec("npx", ["tsc", "-b", "--pretty", "false"], workDir) === 0;
  const lint = changed.length === 0 || exec("npx", ["eslint", ...changed], workDir) === 0;
  return { suite, hidden, typecheck, lint };
}

export function acceptanceScore(checks: AcceptanceChecks): number {
  const values = [checks.suite, checks.hidden, checks.typecheck, checks.lint];
  return values.filter(Boolean).length / values.length;
}

function textOf(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    return output
      .map((block: unknown) =>
        typeof block === "object" && block !== null && "text" in block ? String(block.text) : "",
      )
      .join("\n");
  }
  return output === undefined ? "" : JSON.stringify(output);
}

/** A string field of a tool call's input; empty when absent or not a string. */
function inputField(call: ToolCall, field: string): string {
  const input = call.input;
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

const EXIT_BY_NAMESPACE: Readonly<Record<string, number>> = {
  input: 3,
  policy: 2,
  state: 4,
  runtime: 5,
};

/** The exit code of a kernel call: the host's `Exit code N` line, else the refusal's rule namespace. */
function kernelExit(output: string): number {
  const exit = /^Exit code (\d+)/.exec(output);
  if (exit !== null) return Number(exit[1]);
  const rule =
    /"refused":\s*true[\s\S]*?"rule":\s*"(\w+)\//.exec(output) ?? /^refused: (\w+)\//m.exec(output);
  return rule === null ? 0 : (EXIT_BY_NAMESPACE[rule[1] ?? ""] ?? 1);
}

export interface KernelCalls {
  readonly calls: number;
  readonly exit3: number;
  readonly exit2: number;
}

/** `bdk` as a command word: at the start or after a shell operator, as the plugin's launcher runs. */
const BDK_COMMAND = /(?:^|[;&|(`])\s*bdk(?:\s|$)/m;

/** A Bash command that runs the kernel, through the launcher or by the bundle path. */
function runsKernel(command: string): boolean {
  return BDK_COMMAND.test(command) || command.includes("dist/bdk.mjs");
}

/** Kernel calls by the orchestrator and its subagents, with the input errors (3) and refusals (2) among them. */
export function kernelCalls(toolCalls: readonly ToolCall[]): KernelCalls {
  const exits = toolCalls
    .filter((call) => call.name === "Bash" && runsKernel(inputField(call, "command")))
    .map((call) => kernelExit(textOf(call.output)));
  return {
    calls: exits.length,
    exit3: exits.filter((code) => code === 3).length,
    exit2: exits.filter((code) => code === 2).length,
  };
}

const REPORT_START = "The report follows:\n";

/** The subagent's final report inside the host's hand-back frame, or null for a launch without a report. */
function reportOf(output: string): string | null {
  const start = output.indexOf(REPORT_START);
  if (start < 0) return null;
  const body = output.slice(start + REPORT_START.length);
  const end = body.indexOf("\nagentId:");
  return (end < 0 ? body : body.slice(0, end))
    .split("\n")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n")
    .trim();
}

/** Mean byte length of the reports that BDK role subagents returned; null when none returned in the foreground. */
export function envelopeBytes(toolCalls: readonly ToolCall[]): number | null {
  const sizes = toolCalls
    .filter((call) => call.name === "Agent" && inputField(call, "subagent_type").startsWith("bdk:"))
    .map((call) => reportOf(textOf(call.output)))
    .filter((report): report is string => report !== null)
    .map((report) => Buffer.byteLength(report));
  return sizes.length === 0 ? null : sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
}

export interface PartTasks {
  readonly id: string;
  readonly tasks: readonly string[];
}

export interface V3State {
  readonly attempts: readonly {
    readonly ticket: string;
    readonly loop: string;
    readonly target: string;
    readonly outcome: string | null;
  }[];
  readonly packages: readonly {
    /** The task or part the package targets. */
    readonly target: string;
    readonly role: string;
    readonly ticket: string;
    readonly templateHash: string | null;
  }[];
  readonly reports: readonly {
    readonly target: string;
    readonly role: string;
    readonly ticket: string;
  }[];
  readonly evidence: readonly {
    readonly kind: string;
    readonly target: string;
    readonly ticket: string;
    readonly verdict: string;
  }[];
  /** `BDK-Task` trailer values on the branch, oldest first. */
  readonly trailerTasks: readonly string[];
  /** Parts with an `execute-part:<nn> done` transition. */
  readonly partsDone: readonly string[];
}

/**
 * Eight steps per part (#166: its `part` ticket opened, the implementer's
 * package and report, the conformer's report, `conform`, `tests-scoped` and
 * `lint` evidence passing, `part done`) and one per task, its commit with the
 * task trailer. Evidence counts only from a ticket closed `ok`: `attempt
 * close` refuses stale evidence, so an ok close is where the evidence was fresh.
 */
export function v3Completeness(parts: readonly PartTasks[], state: V3State): number {
  let present = 0;
  let expected = 0;
  for (const part of parts) {
    const attempts = state.attempts.filter(
      (entry) => entry.loop === "part" && entry.target === part.id,
    );
    const okTickets = new Set(
      attempts.filter((entry) => entry.outcome === "ok").map((entry) => entry.ticket),
    );
    const passing = (kind: string): boolean =>
      state.evidence.some(
        (entry) =>
          entry.target === part.id &&
          entry.kind === kind &&
          entry.verdict === "pass" &&
          okTickets.has(entry.ticket),
      );
    const of = (entry: { readonly target: string; readonly role: string }, role: string) =>
      entry.target === part.id && entry.role === role;
    const steps = [
      attempts.length > 0,
      state.packages.some((entry) => of(entry, "implementer")),
      state.reports.some((entry) => of(entry, "implementer")),
      state.reports.some((entry) => of(entry, "conformer")),
      passing("conform"),
      passing("tests-scoped"),
      passing("lint"),
      state.partsDone.includes(part.id),
      ...part.tasks.map((task) => state.trailerTasks.includes(task)),
    ];
    present += steps.filter(Boolean).length;
    expected += steps.length;
  }
  return present / expected;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

function frontmatter(path: string): Record<string, unknown> {
  const match = FRONTMATTER.exec(readFileSync(path, "utf8"));
  return match === null ? {} : ((parse(match[1] ?? "") as Record<string, unknown> | null) ?? {});
}

function field(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

/** Files of one kind of Change directory entry, across every Change of the copy, sorted by name. */
function entries(
  workDir: string,
  sub: string,
  name: RegExp,
): { path: string; match: RegExpExecArray }[] {
  const changes = join(workDir, ".bdk/changes");
  if (!existsSync(changes)) return [];
  return readdirSync(changes, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((change) => {
      const dir = join(changes, change.name, sub);
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .sort()
        .flatMap((file) => {
          const match = name.exec(file);
          return match === null ? [] : [{ path: join(dir, file), match }];
        });
    });
}

/** A package or report of a task or a part: `<target>-<role>-<ticket>.md`. */
const TARGET_FILE = /^(\d{2}(?:-\d+)?)-([a-z-]+)-(A-[a-z0-9]+)\.md$/;

export function readV3State(workDir: string): V3State {
  const attempts = entries(workDir, "attempts", /\.md$/).map(({ path }) => {
    const data = frontmatter(path);
    const outcome = field(data, "outcome");
    return {
      ticket: field(data, "ticket"),
      loop: field(data, "loop"),
      target: field(data, "target"),
      outcome: outcome === "" ? null : outcome,
    };
  });
  const packages = entries(workDir, "dispatch", TARGET_FILE).map(({ path, match }) => {
    const hash = field(frontmatter(path), "template-hash");
    return {
      target: match[1] ?? "",
      role: match[2] ?? "",
      ticket: match[3] ?? "",
      templateHash: hash === "" ? null : hash,
    };
  });
  const reports = entries(workDir, "reports", TARGET_FILE).map(({ match }) => ({
    target: match[1] ?? "",
    role: match[2] ?? "",
    ticket: match[3] ?? "",
  }));
  // Evidence manifests only; their stored outputs (`<id>-tests.txt`, copied reports) sit next to them.
  const evidence = entries(workDir, "evidence", /^\d{2}(?:-\d+)?-E-[a-z0-9]+\.md$/).map(
    ({ path }) => {
      const data = frontmatter(path);
      return {
        kind: field(data, "kind"),
        target: field(data, "target"),
        ticket: field(data, "ticket"),
        verdict: field(data, "verdict"),
      };
    },
  );
  const partsDone = entries(workDir, "log", /-transition-L-[a-z0-9]+\.md$/).flatMap(({ path }) => {
    const done = /^execute-part:(\d+) done$/.exec(field(frontmatter(path), "summary"));
    return done === null ? [] : [done[1] ?? ""];
  });
  const trailerTasks = [
    ...new Set(
      lines(git(workDir, "log", "--reverse", "--format=%(trailers:key=BDK-Task,valueonly)")),
    ),
  ];
  return { attempts, packages, reports, evidence, trailerTasks, partsDone };
}

export interface V2State {
  /** Groups committed with `BDK-Group` and the run's `BDK-Run` trailer. */
  readonly groups: readonly string[];
  /** `groups_done` of the run manifest, or null without a manifest. */
  readonly manifestGroups: readonly string[] | null;
}

function byNumber(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

export function readV2State(workDir: string): V2State {
  const runs = join(workDir, ".bdk/runs");
  const manifest = existsSync(runs)
    ? readdirSync(runs)
        .filter((file) => file.endsWith(".json"))
        .sort()
        .map(
          (file) =>
            JSON.parse(readFileSync(join(runs, file), "utf8")) as {
              run_id?: string;
              groups_done?: Record<string, string>;
            },
        )[0]
    : undefined;
  const commits = lines(
    git(
      workDir,
      "log",
      "--format=%(trailers:key=BDK-Run,valueonly,separator=%x2C)|%(trailers:key=BDK-Group,valueonly,separator=%x2C)",
    ),
  ).map((line) => {
    const [run = "", group = ""] = line.split("|");
    return { run, group };
  });
  const groups = commits
    .filter((commit) => commit.run !== "" && commit.group !== "")
    .filter((commit) => manifest?.run_id === undefined || commit.run === manifest.run_id)
    .map((commit) => commit.group);
  return {
    groups: byNumber(groups),
    manifestGroups:
      manifest === undefined ? null : byNumber(Object.keys(manifest.groups_done ?? {})),
  };
}

/**
 * Per group a commit with the run's trailers, a test-runner and a
 * static-analyse spawn after the group's implementer; per task an implementer
 * spawn; once, a manifest with every group done. Verifier spawns are matched
 * to groups through the windows between consecutive implementer spawns.
 */
export function v2Completeness(
  plan: { readonly groups: number; readonly tasks: number },
  toolCalls: readonly ToolCall[],
  state: V2State,
): number {
  const types = toolCalls
    .filter((call) => call.name === "Agent")
    .map((call) => inputField(call, "subagent_type"));
  const windows: string[][] = [];
  for (const type of types) {
    if (type === "bdk:implementer") windows.push([]);
    else windows.at(-1)?.push(type);
  }
  const verified = (type: string): number =>
    Math.min(windows.filter((window) => window.includes(type)).length, plan.groups);
  const expectedGroups = Array.from({ length: plan.groups }, (_, index) => String(index + 1));
  const present =
    expectedGroups.filter((group) => state.groups.includes(group)).length +
    Math.min(windows.length, plan.tasks) +
    verified("bdk:test-runner") +
    verified("bdk:static-analyse") +
    (expectedGroups.every((group) => state.manifestGroups?.includes(group) === true) ? 1 : 0);
  return present / (plan.groups * 3 + plan.tasks + 1);
}
