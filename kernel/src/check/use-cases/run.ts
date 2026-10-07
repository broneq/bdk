// `bdk check run <task|part|change-id> --ticket <ticket>` (`kernel-cli/check`;
// #166): the diff check of the target, then the project's commands of each
// kernel-run step kind with stdin closed and a timeout, their outputs under
// the ticket's own directory, one kernel manifest per kind, and the git
// command that commits the target's declared paths. A review round's fix,
// the Change id under a `review-fix` ticket, gets no command: `bdk commit`
// commits it. The agent never composes, runs or records a check itself.
import { join, relative } from "node:path";

import { stepCommands } from "../domain/commands.ts";
import type { ToolLists } from "../domain/commands.ts";
import { commitCommand, kindVerdict, overallVerdict } from "../domain/report.ts";
import type { CheckItem, CheckRunReport, CheckVerdict } from "../domain/report.ts";
import { executionChecksModule } from "../config.ts";
import { recordEvidence } from "../../evidence/index.ts";
import { targetSteps } from "../../graph/index.ts";
import { withChangeIndex } from "../../log/index.ts";
import { diffCheck } from "../../part/index.ts";
import { moduleValue, resolveOrRefuse, toolGroup, toolsModule } from "../../shared/config/index.ts";
import { mergeInProgress, tailLines } from "../../shared/git/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  readAttempts,
  readPlanParts,
  TASK_ID,
  taskHolders,
  workRootOf,
} from "../../shared/store/index.ts";
import type { PlanPartFile } from "../../shared/store/index.ts";
import type { CheckDeps } from "./deps.ts";

const PART_ID = /^\d{2}$/;
const CHECKS_DIR = ".bdk/.machine/checks";
const TAIL_LINES = 20;
const NOT_FOUND = 127;

export interface CheckInput {
  readonly target: string;
  readonly ticket: string;
  /** `--skip` tool ids. */
  readonly skip: readonly string[];
}

export interface CheckWhere {
  readonly globalDir: string;
}

/** What one check run of a target needs, read before any command runs. */
interface Plan {
  /** The part of a task or part target; undefined for the Change under a review round. */
  readonly part: PlanPartFile | undefined;
  readonly tools: ToolLists;
  readonly timeout: number;
}

export function runChecks(
  deps: CheckDeps,
  change: ActiveChange,
  where: CheckWhere,
  input: CheckInput,
): Promise<CheckRunReport | Refusal> {
  return withChangeIndex(deps, change, async (index): Promise<CheckRunReport | Refusal> => {
    const plan = readPlan(deps, change, where, input);
    if (isRefusal(plan)) return plan;
    const diff = await diffCheck(
      deps,
      change,
      index,
      plan.part === undefined
        ? { change: true }
        : TASK_ID.test(input.target)
          ? { task: input.target }
          : { part: input.target },
    );
    if ("refused" in diff) return diff;
    const steps = await targetSteps(deps, change, index, where.globalDir, input.target);
    if (isRefusal(steps)) return steps;
    const parts = readPlanParts(deps.store, change.dir);
    const root = await workRootOf(deps.git, deps.store, change, parts, input.target);
    const dir = join(change.projectRoot, CHECKS_DIR, input.ticket);

    const checks: CheckItem[] = [];
    const evidence: Record<string, string> = {};
    const verdicts: CheckVerdict[] = [];
    for (const kind of steps.steps.filter((step) => "command" in step).map((step) => step.kind)) {
      const own = await runKind(deps, {
        kind,
        dir,
        root,
        files: steps.files,
        plan,
        input,
        projectRoot: change.projectRoot,
      });
      const verdict = kindVerdict(own.filter((check) => check.skipped === undefined));
      const recorded = await recordEvidence(
        deps,
        change,
        { cwd: change.projectRoot, globalDir: where.globalDir },
        {
          kind,
          files: own.map((check) => join(change.projectRoot, check.file)),
          ticket: input.ticket,
          verdict,
          citations: [],
          kernel: true,
          target: input.target,
        },
      );
      if (isRefusal(recorded)) return recorded;
      evidence[kind] = recorded.evidence;
      verdicts.push(verdict);
      checks.push(...own.filter((check) => check.tool !== ""));
    }

    const verdict = overallVerdict(verdicts);
    const paths = [...diff.declared].sort();
    // Git refuses a partial commit during a merge; the merge ticket's `ok` close commits it.
    const commit =
      verdict === "fail" ||
      paths.length === 0 ||
      plan.part === undefined ||
      (await mergeInProgress(deps.git, root))
        ? undefined
        : {
            paths,
            command: commitCommand({
              paths,
              ...commitText(change, plan.part, input),
              workdir: root === change.projectRoot ? undefined : root,
            }),
          };
    return {
      target: input.target,
      ticket: input.ticket,
      verdict,
      checks,
      evidence,
      diff: { declared: diff.declared, touched: diff.touched, undeclared: diff.undeclared },
      ...(commit === undefined ? {} : { commit }),
    };
  });
}

/** The subject and trailers: a task's title and `BDK-Task`, or a part's conform commit and `BDK-Ticket`. */
function commitText(
  change: ActiveChange,
  part: PlanPartFile,
  input: CheckInput,
): { readonly subject: string; readonly trailers: Readonly<Record<string, string>> } {
  const base = { "BDK-Change": change.id, "BDK-Part": part.id };
  return TASK_ID.test(input.target)
    ? {
        subject: part.tasks.find((found) => found.id === input.target)?.title ?? input.target,
        trailers: { ...base, "BDK-Task": input.target },
      }
    : {
        subject: `refactor(${part.id}): conform part ${part.id}`,
        trailers: { ...base, "BDK-Ticket": input.ticket },
      };
}

/** The ticket, the target, the settings and `--skip`, each checked before anything runs. */
function readPlan(
  deps: CheckDeps,
  change: ActiveChange,
  where: CheckWhere,
  input: CheckInput,
): Plan | Refusal {
  const record = readAttempts(deps.store, change.dir).find(
    ({ data }) => data.ticket === input.ticket,
  )?.data;
  if (
    record === undefined ||
    record.outcome !== undefined ||
    (record.loop !== "part" && record.loop !== "verify-fix" && record.loop !== "review-fix")
  ) {
    return refuse(
      "policy/no-open-ticket",
      record === undefined
        ? `${change.id} has no ticket ${input.ticket}`
        : record.outcome !== undefined
          ? `ticket ${input.ticket} is already closed ${record.outcome}`
          : `ticket ${input.ticket} is a ${record.loop} ticket; only a part, verify-fix or review-fix ticket runs checks`,
      ["bdk attempt list"],
    );
  }
  const part =
    record.loop === "review-fix"
      ? roundTarget(change, input)
      : planTarget(deps, change, input, record.target);
  if (part !== undefined && isRefusal(part)) return part;
  return settingsOf(deps, change, where, input, part);
}

/** A review round checks its fix over the whole Change: the target is the Change id. */
function roundTarget(change: ActiveChange, input: CheckInput): undefined | Refusal {
  if (input.target === change.id) return undefined;
  return refuse(
    "input/invalid-argument",
    `ticket ${input.ticket} is a review round of ${change.id}; it checks the Change, not ${input.target}`,
    [`bdk check run ${change.id} --ticket ${input.ticket}`],
  );
}

/** The plan part of a task or part target, which must be the part the ticket works on. */
function planTarget(
  deps: CheckDeps,
  change: ActiveChange,
  input: CheckInput,
  ticketPart: string,
): PlanPartFile | Refusal {
  const parts = readPlanParts(deps.store, change.dir);
  const task = TASK_ID.test(input.target);
  if (!task && !PART_ID.test(input.target)) {
    return refuse("input/invalid-argument", `${input.target} is neither a task nor a part id`, [
      `bdk check run ${ticketPart} --ticket ${input.ticket}`,
    ]);
  }
  const part = task
    ? taskHolders(parts).get(input.target)
    : parts.find((found) => found.id === input.target);
  if (part === undefined) {
    return refuse(
      "input/not-found",
      `${change.id} has no plan ${task ? "task" : "part"} ${input.target}`,
      ["bdk part list"],
    );
  }
  if (part.id !== ticketPart) {
    return refuse(
      "input/invalid-argument",
      `ticket ${input.ticket} works on part ${ticketPart}; ${input.target} belongs to part ${part.id}`,
      [`bdk check run ${ticketPart} --ticket ${input.ticket}`],
    );
  }
  return part;
}

/** The tool lists, the timeout and `--skip`, checked against the settings. */
function settingsOf(
  deps: CheckDeps,
  change: ActiveChange,
  where: CheckWhere,
  input: CheckInput,
  part: PlanPartFile | undefined,
): Plan | Refusal {
  const resolved = resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir: where.globalDir,
      projectRoot: change.projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
  if ("refused" in resolved) return resolved;
  const tools = moduleValue(toolsModule, resolved.value);
  const lists: ToolLists = {
    test: toolGroup(tools, "test").entries,
    lint: toolGroup(tools, "lint").entries,
  };
  for (const id of input.skip) {
    const entry = [...lists.test, ...lists.lint].find((found) => found.id === id);
    if (entry?.when === undefined) {
      return refuse(
        "input/invalid-argument",
        entry === undefined
          ? `--skip ${id}: no tools.test or tools.lint entry is ${id}`
          : `--skip ${id}: the entry has no when, so it applies to every target`,
        [`bdk check run ${input.target} --ticket ${input.ticket}`],
      );
    }
  }
  return {
    part,
    tools: lists,
    timeout: moduleValue(executionChecksModule, resolved.value).timeout,
  };
}

/**
 * The checks of one kind: each command run, or a file stating why none ran.
 * A placeholder item with an empty `tool` carries the file of a kind that ran
 * nothing, so its manifest still lists a file.
 */
async function runKind(
  deps: CheckDeps,
  input: {
    readonly kind: string;
    readonly dir: string;
    readonly root: string;
    readonly files: readonly string[];
    readonly plan: Plan;
    readonly input: CheckInput;
    readonly projectRoot: string;
  },
): Promise<CheckItem[]> {
  const { kind, dir, plan, projectRoot } = input;
  const { target } = input.input;
  const commands = stepCommands(kind, plan.tools, input.files.join(" "));
  const fileOf = (tool: string) => join(dir, `${target}-${kind}-${tool}.txt`);
  const rel = (path: string) => relative(projectRoot, path);
  if (commands.length === 0 || input.files.length === 0) {
    const why =
      input.files.length === 0
        ? `${target} has no executable file`
        : `no command is configured for ${kind}`;
    const path = fileOf("none");
    deps.store.write(path, `not-run: ${why}\n`);
    return [{ kind, tool: "", command: "", verdict: "not-run", file: rel(path) }];
  }
  const checks: CheckItem[] = [];
  for (const command of commands) {
    const path = fileOf(command.tool);
    if (input.input.skip.includes(command.tool)) {
      deps.store.write(path, `skipped: ${command.when ?? ""}\n`);
      checks.push({
        kind,
        tool: command.tool,
        command: command.command,
        skipped: command.when ?? "",
        verdict: "not-run",
        file: rel(path),
      });
      continue;
    }
    const run = await deps.shell(command.command, input.root, plan.timeout * 1000);
    const end = run.timedOut ? `timeout ${String(plan.timeout)}` : `exit ${String(run.exitCode)}`;
    const body = run.output === "" || run.output.endsWith("\n") ? run.output : `${run.output}\n`;
    deps.store.write(path, `${body}${end}\n`);
    const verdict: CheckVerdict =
      run.timedOut || (run.exitCode !== 0 && run.exitCode !== NOT_FOUND)
        ? "fail"
        : run.exitCode === NOT_FOUND
          ? "not-run"
          : "pass";
    checks.push({
      kind,
      tool: command.tool,
      command: command.command,
      ...(run.timedOut ? { timeout: plan.timeout } : { exit: run.exitCode }),
      verdict,
      file: rel(path),
      ...(verdict === "fail" ? { tail: tailLines(run.output, TAIL_LINES) } : {}),
    });
  }
  return checks;
}
