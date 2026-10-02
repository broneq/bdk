// `bdk attempt open <loop> <target> [--escalate]` (`kernel-cli/attempt`;
// T22 design D-1, D-2, D-5): checks the target, the open tickets and the
// round, then writes the record. Every check runs before the first write.
import { join } from "node:path";

import {
  budgetUsed,
  currentRound,
  escalationBlocked,
  inScope,
  roundState,
  scopeFor,
} from "../domain/ladder.ts";
import type { RoundState, Scope } from "../domain/ladder.ts";
import type { AttemptOpenReport, DroppedFinding } from "../domain/reports.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { workTargets } from "../../part/index.ts";
import type { WorkTargets } from "../../part/index.ts";
import { authorIdent } from "../../shared/git/index.ts";
import { newId } from "../../shared/ids/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  checkpointChange,
  filesOverlap,
  readPlanParts,
  TASK_ID,
  taskHolders,
  writeDocument,
} from "../../shared/store/index.ts";
import type { EntryRow, IndexDb, PlanPartFile } from "../../shared/store/index.ts";
import { LOOPS } from "../../shared/vocabulary/index.ts";
import type { Loop } from "../../shared/vocabulary/index.ts";
import type { AttemptDeps } from "./deps.ts";
import { escalationsOf, keyedRecords, ladderPolicy, ofKey, resumeCommand } from "./records.ts";
import type { KeyedRecord } from "./records.ts";

const PART_ID = /^\d{2}$/;
const SUMMARY_MAX = 120;

export interface OpenInput {
  readonly loop: string;
  readonly target: string;
  readonly escalate: boolean;
}

export function openAttempt(
  deps: AttemptDeps,
  change: ActiveChange,
  globalDir: string,
  input: OpenInput,
): Promise<AttemptOpenReport | Refusal> {
  if (!isLoop(input.loop)) {
    return Promise.resolve(
      refuse("input/invalid-argument", `${input.loop} is not a loop; loops: ${LOOPS.join(", ")}`, [
        "bdk attempt open task-redispatch <task>",
      ]),
    );
  }
  const loop = input.loop;
  return withChangeIndex(deps, change, async (index) => {
    const targets = await workTargets(deps, change, index, globalDir);
    if ("refused" in targets) return targets;
    const unfit = checkTarget(deps, change, targets, loop, input.target);
    if (unfit !== undefined) return unfit;

    const records = keyedRecords(deps.store, change.dir);
    const key = ofKey(records, loop, input.target);
    const open = key.find((record) => record.outcome === undefined);
    if (open !== undefined) {
      return refuse(
        "policy/ticket-open",
        `ticket ${open.ticket} of ${loop} ${input.target} is still open`,
        [`bdk attempt close ${open.ticket} ok|fail|not-run`],
      );
    }
    const parts = readPlanParts(deps.store, change.dir);
    const busy = filesBusy(parts, records, loop, input.target);
    if (busy !== undefined) return busy;
    const policy = ladderPolicy(targets.settings, loop);
    const state = roundState(currentRound(key, targets.entries), policy);
    const blocked = escalationBlocked(state, policy, escalationsOf(records));
    const refusal = input.escalate
      ? checkEscalation(state, blocked)
      : checkPlain(change, loop, input.target, state, blocked, targets.parked !== undefined);
    if (refusal !== undefined) return refusal;

    const scope: Scope = input.escalate ? (state.scope ?? "full") : scopeFor(state.attempt);
    const narrowedFrom =
      !input.escalate && state.scope !== undefined && state.scope !== scope
        ? state.scope
        : undefined;
    const dropped =
      narrowedFrom === undefined || state.lastFail === undefined
        ? []
        : droppedFindings(targets.entries, state.lastFail, scope);

    if (input.escalate) {
      await checkpointChange({
        store: deps.store,
        git: deps.git,
        projectRoot: change.projectRoot,
        change,
        settings: targets.settings,
      });
    }
    const ticket = newId("A-", deps.random);
    const openedAt = deps.clock.now();
    const path = join(change.dir, "attempts", `${loop}-${input.target}-${ticket}.md`);
    writeDocument(deps.store, path, {
      data: {
        schema: 1,
        ticket,
        loop,
        target: input.target,
        attempt: state.attempt,
        // Budget 0 allows no plain ticket; its escalation ticket still counts as one of one.
        of: Math.max(state.of, 1),
        scope,
        ...(narrowedFrom === undefined ? {} : { "narrowed-from": narrowedFrom }),
        ...(input.escalate ? { escalation: true, model: policy.escalation.model } : {}),
        "opened-at": openedAt,
        author: await authorIdent(deps.git, change.projectRoot),
        ...(dropped.length === 0 ? {} : { dropped: dropped.map((entry) => entry.id) }),
      },
      body: "",
    });
    // Two opens of one key can race; the loser removes its own record.
    const rival = ofKey(keyedRecords(deps.store, change.dir), loop, input.target).find(
      (record) => record.outcome === undefined && record.ticket !== ticket,
    );
    if (rival !== undefined) {
      deps.store.remove(path);
      return refuse(
        "policy/ticket-open",
        `ticket ${rival.ticket} of ${loop} ${input.target} was opened at the same time`,
        [`bdk attempt close ${rival.ticket} ok|fail|not-run`],
      );
    }

    // Two opens over one file can race too; each loser removes its own record.
    const crossed = filesBusy(
      parts,
      keyedRecords(deps.store, change.dir).filter((record) => record.ticket !== ticket),
      loop,
      input.target,
    );
    if (crossed !== undefined) {
      deps.store.remove(path);
      return crossed;
    }

    const entry =
      dropped.length === 0
        ? undefined
        : await recordDropped(deps, change, index, input.target, scope, dropped);
    if (entry !== undefined && "refused" in entry) return entry;
    return {
      ticket,
      loop,
      target: input.target,
      attempt: state.attempt,
      of: Math.max(state.of, 1),
      scope,
      openedAt,
      ...(narrowedFrom === undefined ? {} : { narrowedFrom }),
      ...(dropped.length === 0 ? {} : { dropped }),
      ...(entry === undefined ? {} : { entry: entry.id }),
      ...(input.escalate ? { escalation: { model: policy.escalation.model } } : {}),
      ...(loop === "verifier" || loop === "part-lead" ? {} : { steps: targets.steps }),
    };
  });
}

/** The loops whose tickets change the files of their target. */
const CODE_LOOPS: readonly string[] = ["task-redispatch", "verify-fix"];

/** The `Files:` of a task target, or of every task of a part target. */
function filesOf(parts: readonly PlanPartFile[], loop: string, target: string): string[] {
  if (loop === "task-redispatch") {
    const task = taskHolders(parts)
      .get(target)
      ?.tasks.find((found) => found.id === target);
    return task?.files.map((file) => file.path) ?? [];
  }
  const part = parts.find((found) => found.id === target);
  return part?.tasks.flatMap((task) => task.files.map((file) => file.path)) ?? [];
}

/**
 * Parts and tasks share one working tree, so two open tickets never hold one
 * file (`policy/files-busy`): the later target waits for the earlier ticket.
 */
function filesBusy(
  parts: readonly PlanPartFile[],
  records: readonly KeyedRecord[],
  loop: Loop,
  target: string,
): Refusal | undefined {
  if (!CODE_LOOPS.includes(loop)) return undefined;
  const own = filesOf(parts, loop, target);
  for (const record of records) {
    if (record.outcome !== undefined || !CODE_LOOPS.includes(record.loop)) continue;
    if (record.loop === loop && record.target === target) continue;
    const path = filesOverlap(own, filesOf(parts, record.loop, record.target));
    if (path !== undefined) {
      return refuse(
        "policy/files-busy",
        `${path} of ${target} is in the Files: of ticket ${record.ticket} (${record.loop} ${record.target})`,
        [`bdk attempt list`, `bdk agents wait`],
      );
    }
  }
  return undefined;
}

function isLoop(value: string): value is Loop {
  return (LOOPS as readonly string[]).includes(value);
}

/** The target fits the loop and is ready for work. */
function checkTarget(
  deps: AttemptDeps,
  change: ActiveChange,
  targets: WorkTargets,
  loop: Loop,
  target: string,
): Refusal | undefined {
  const wrongType = (expected: string): Refusal =>
    refuse("input/invalid-argument", `${loop} takes ${expected}; ${target} is not one`, [
      `bdk attempt open ${loop} <${expected}>`,
    ]);
  if (loop === "task-redispatch" || loop === "verify-fix" || loop === "part-lead") {
    const task = loop === "task-redispatch";
    if (!(task ? TASK_ID : PART_ID).test(target)) return wrongType(task ? "task id" : "part id");
    const parts = readPlanParts(deps.store, change.dir);
    const part = task ? taskHolders(parts).get(target) : parts.find((found) => found.id === target);
    if (part === undefined) {
      return refuse("input/not-found", `no plan part holds ${task ? "task" : "part"} ${target}`, [
        "bdk part list",
      ]);
    }
    if (!targets.started.has(part.id)) {
      return refuse("policy/not-ready", `part ${part.id} is not started`, [
        `bdk part start ${part.id}`,
      ]);
    }
    return undefined;
  }
  if (loop === "review-fix") {
    if (target !== change.id) return wrongType("the Change id");
    return notReady(targets, "review", ["blocked"]);
  }
  if (TASK_ID.test(target) || PART_ID.test(target) || target === change.id) {
    return wrongType("artifact id");
  }
  if (targets.node(target) === undefined) {
    return refuse("input/not-found", `the graph of ${change.id} has no artifact ${target}`, [
      "bdk status",
    ]);
  }
  return notReady(targets, target, ["blocked", "skipped"]);
}

function notReady(
  targets: WorkTargets,
  id: string,
  states: readonly string[],
): Refusal | undefined {
  const node = targets.node(id);
  if (node === undefined || !states.includes(node.state)) return undefined;
  return refuse("policy/not-ready", `${id} is ${node.state}${node.why ? `: ${node.why}` : ""}`, [
    `bdk explain ${id}`,
  ]);
}

function checkEscalation(state: RoundState, blocked: string | undefined): Refusal | undefined {
  if (!budgetUsed(state) && state.oscillating === undefined) {
    return refuse(
      "policy/invalid-transition",
      `the round has used ${String(state.used)} of ${String(state.of)} attempts and does not oscillate; escalation comes after the budget`,
      ["bdk attempt open <loop> <target>"],
    );
  }
  if (blocked !== undefined) {
    return refuse("policy/invalid-transition", `no escalation ticket: ${blocked}`, [
      "bdk change status",
    ]);
  }
  return undefined;
}

function checkPlain(
  change: ActiveChange,
  loop: Loop,
  target: string,
  state: RoundState,
  blocked: string | undefined,
  parked: boolean,
): Refusal | undefined {
  if (state.oscillating === undefined && !budgetUsed(state)) return undefined;
  const instead =
    blocked === undefined
      ? `bdk attempt open ${loop} ${target} --escalate`
      : parked
        ? resumeCommand(change.id)
        : `bdk change park --reason "${loop} ${target} used its budget"`;
  if (state.oscillating !== undefined) {
    return refuse(
      "policy/oscillation",
      `fingerprint ${state.oscillating} recurs in failed attempts of ${loop} ${target}`,
      [instead],
    );
  }
  return refuse(
    "policy/budget-exhausted",
    `${loop} ${target} used ${String(state.used)} of ${String(state.of)} attempts in this round`,
    [instead],
  );
}

/** The `proposed` findings of the previous `fail` ticket that fall outside `scope`. */
function droppedFindings(
  entries: readonly EntryRow[],
  lastFail: string,
  scope: Scope,
): DroppedFinding[] {
  return entries
    .filter(
      (entry) =>
        entry.ticket === lastFail &&
        entry.status === "proposed" &&
        (entry.type === "finding" || entry.type === "blocker") &&
        !inScope(scope, entry),
    )
    .map((entry) => ({ id: entry.id, summary: entry.summary }));
}

async function recordDropped(
  deps: AttemptDeps,
  change: ActiveChange,
  index: IndexDb,
  target: string,
  scope: Scope,
  dropped: readonly DroppedFinding[],
): Promise<{ readonly id: string } | Refusal> {
  const count = dropped.length;
  const summary = `scope ${scope} of ${target} drops ${String(count)} finding${count === 1 ? "" : "s"} for the review gate`;
  const written = await appendEntry(
    deps,
    change,
    index,
    {
      type: "finding",
      summary: summary.slice(0, SUMMARY_MAX),
      status: "proposed",
      review: true,
      refs: [target, ...dropped.map((entry) => entry.id)],
      body: `${dropped.map((entry) => `- ${entry.id}: ${entry.summary}`).join("\n")}\n`,
    },
    { dedupe: true },
  );
  return "refused" in written ? written : { id: written.entry.id };
}
