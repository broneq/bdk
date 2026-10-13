// `bdk check plan` (spec `bdk-cli/check`, "Plan the checks"): resolves which configured check
// commands to run and the line the agent runs for each, runs none of them, and writes the plan.

import { isAbsolute, relative } from "node:path";

import { loadConfig } from "../../config/index.ts";
import type { ConfigDeps } from "../../config/index.ts";
import { CliError } from "../../shared/cli/index.ts";
import { GitError } from "../../shared/git/index.ts";
import {
  bashCap,
  bashTimeout,
  KINDS,
  lineOf,
  notesOf,
  nulPaths,
  planChecks,
  POINTS,
  scopeOf,
} from "../domain/plan.ts";
import type { Kind, Point, Tools } from "../domain/plan.ts";
import type { CheckPlan } from "../schema/plan.ts";
import { outputPath, planPath, writeResult } from "../store/results.ts";
import { absolute, checkId, checkRunDir, invalid } from "./deps.ts";
import type { CheckDeps } from "./deps.ts";

export interface PlanInput {
  readonly runDir: string;
  readonly id: string;
  readonly scope?: readonly string[] | undefined;
  readonly tests?: readonly string[] | undefined;
  readonly at?: string | undefined;
  readonly changed?: string | undefined;
  readonly kinds?: readonly string[] | undefined;
}

function kindsOf(values: readonly string[] | undefined): readonly Kind[] | undefined {
  if (values === undefined || values.length === 0) return undefined;
  return values.map((value) => {
    const kind = KINDS.find((known) => known === value);
    if (kind === undefined) {
      throw invalid(`--kind ${value} is not a kind; use test, lint or build`, "plan");
    }
    return kind;
  });
}

function pointOf(value: string | undefined): Point | undefined {
  if (value === undefined) return undefined;
  const point = POINTS.find((known) => known === value);
  if (point === undefined) {
    throw invalid(`--at ${value} is not a point; use part, wave or review`, "plan");
  }
  return point;
}

/**
 * The files git reports changed against `ref` in `root`: tracked files that differ in the working
 * tree or the index, deletions left out, plus untracked files that are not ignored.
 */
function changedFiles(git: CheckDeps["git"], root: string, ref: string): readonly string[] {
  const attempt = (args: readonly string[]): string | undefined => {
    try {
      return git(root, args);
    } catch (error) {
      if (error instanceof GitError) return undefined;
      throw error;
    }
  };
  if (attempt(["rev-parse", "--is-inside-work-tree"]) !== "true\n") {
    throw new CliError(
      "env/not-a-repo",
      `${root} is not inside a git work tree`,
      "plan the checks without --changed, or in the repository of the Change",
    );
  }
  const unknown = invalid(`--changed ${ref} names no commit git can resolve`, "plan");
  if (ref.startsWith("-")) throw unknown;
  if (attempt(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) === undefined) {
    throw unknown;
  }
  const diff = ["--name-only", "--relative", "--no-renames", "--no-ext-diff", "--diff-filter=d"];
  return [
    ...nulPaths(git(root, ["diff", ...diff, "-z", ref, "--"])),
    ...nulPaths(git(root, ["ls-files", "--others", "--exclude-standard", "-z"])),
  ];
}

function toolsOf(deps: ConfigDeps): { readonly root: string; readonly tools: Tools } {
  const config = loadConfig(deps);
  if (config.status === "not-configured") {
    throw new CliError(
      "env/not-configured",
      `BDK is not configured in ${config.root}: missing ${config.missing.join(" and ")}`,
      "Run /bdk:setup.",
    );
  }
  if (config.status === "invalid") {
    const [first] = config.problems;
    throw new CliError(
      "env/config-invalid",
      `the BDK configuration is invalid${first === undefined ? "" : `: ${first.key}: ${first.message} (${first.file})`}`,
      "Run bdk config check.",
    );
  }
  const { test, lint, build } = config.settings.tools;
  return { root: config.root, tools: { test, lint, build } };
}

/** A path of the line: relative to the project root when inside it, absolute otherwise. */
function fromRoot(root: string, path: string): string {
  const inner = relative(root, path);
  return inner === "" || inner.startsWith("..") || isAbsolute(inner) ? path : inner;
}

export interface PlanOutcome {
  readonly plan: CheckPlan;
  /** The path of the plan file, joined onto the run directory as given. */
  readonly file: string;
}

export function planCheckRun(deps: CheckDeps, input: PlanInput): PlanOutcome {
  const { runDir, id } = input;
  checkId(id, "plan");
  const kinds = kindsOf(input.kinds);
  const point = pointOf(input.at);
  if (input.scope?.includes("") === true) {
    throw invalid("--scope takes a path, not an empty value", "plan");
  }
  if (input.tests?.includes("") === true) {
    throw invalid("--tests takes a path, not an empty value", "plan");
  }
  checkRunDir(deps, runDir);
  const { root, tools } = toolsOf(deps);
  const changed = input.changed === undefined ? [] : changedFiles(deps.git, root, input.changed);
  const scope = scopeOf([...(input.scope ?? []), ...changed]);
  const tests = input.tests === undefined ? null : scopeOf(input.tests);
  const cap = bashCap(deps.env.BASH_MAX_TIMEOUT_MS);

  const selected = planChecks(tools, { kinds, at: point, files: scope, tests });
  const plan: CheckPlan = {
    version: 1,
    id,
    at: point ?? null,
    changed: input.changed ?? null,
    scope: scope === null ? null : [...scope],
    tests: tests === null ? null : [...tests],
    cwd: root,
    checks: selected.checks.map((planned) => {
      const output = outputPath(runDir, id, planned.kind, planned.tool);
      return {
        ...planned,
        "bash-timeout": bashTimeout(planned.timeout, cap),
        output,
        line: lineOf(planned.command, fromRoot(root, absolute(deps, output))),
        notes: [...notesOf(planned.command, planned.timeout, cap)],
      };
    }),
    skipped: [...selected.skipped],
  };
  const file = planPath(runDir, id);
  writeResult(deps.files, absolute(deps, file), plan);
  return { plan, file };
}
