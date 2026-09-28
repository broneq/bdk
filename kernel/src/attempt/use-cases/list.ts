// `bdk attempt list [--for <task|part>] [--all]` (`kernel-cli/attempt`): the
// committed records, open tickets first, then newest first, with the budgets
// of the `--for` target's current rounds.
import { currentRound, roundState } from "../domain/ladder.ts";
import type { AttemptItem, AttemptListReport, Budget } from "../domain/reports.ts";
import { withChangeIndex } from "../../log/index.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { listEntries, readPlanParts, TASK_ID } from "../../shared/store/index.ts";
import type { AttemptDeps } from "./deps.ts";
import { keyedRecords, ladderPolicy } from "./records.ts";
import type { KeyedRecord } from "./records.ts";

export interface ListInput {
  readonly for?: string | undefined;
  readonly all: boolean;
}

export function listAttempts(
  deps: AttemptDeps,
  change: ActiveChange,
  globalDir: string,
  input: ListInput,
): Promise<AttemptListReport | Refusal> {
  return withChangeIndex(deps, change, (index) => {
    const resolved = resolveOrRefuse(
      {
        store: deps.store,
        settings: deps.settings,
        globalDir,
        projectRoot: change.projectRoot,
        pluginRoot: deps.pluginRoot,
      },
      { removed: "ignore" },
    );
    if ("refused" in resolved) return resolved;
    const entries = listEntries(index, change.id);
    const records = keyedRecords(deps.store, change.dir);
    const targets = input.for === undefined ? undefined : targetsOf(deps, change, input.for);
    const inScope = records.filter((record) => targets === undefined || targets.has(record.target));
    const keys = new Map<string, KeyedRecord[]>();
    for (const record of inScope) {
      const key = `${record.loop}\u0000${record.target}`;
      keys.set(key, [...(keys.get(key) ?? []), record]);
    }
    const shown: KeyedRecord[] = [];
    const budgets: Record<string, Budget> = {};
    let notRun: Budget | undefined;
    for (const key of keys.values()) {
      const round = currentRound(key, entries);
      shown.push(...(input.all ? key : round));
      const first = key[0];
      if (first === undefined || first.target !== input.for) continue;
      const policy = ladderPolicy(resolved.value, first.loop);
      const state = roundState(round, policy);
      budgets[first.loop] = { used: state.used, of: state.of };
      if (notRun === undefined || state.notRun > notRun.used) {
        notRun = { used: state.notRun, of: policy.notRunBudget };
      }
    }
    if (notRun !== undefined) budgets["not-run"] = notRun;

    const counted = input.for !== undefined && TASK_ID.test(input.for);
    const items = shown.sort(order).map((record) => item(record, counted ? entries : undefined));
    return {
      items,
      ...(Object.keys(budgets).length === 0 ? {} : { budgets }),
    };
  });
}

/** `--for` a task names the task; `--for` a part names the part and its tasks. */
function targetsOf(deps: AttemptDeps, change: ActiveChange, value: string): Set<string> {
  const part = readPlanParts(deps.store, change.dir).find((found) => found.id === value);
  return new Set([value, ...(part?.tasks.map((task) => task.id) ?? [])]);
}

/** Open tickets first, then the newest `opened-at`, then the ticket. */
function order(a: KeyedRecord, b: KeyedRecord): number {
  const open = Number(b.outcome === undefined) - Number(a.outcome === undefined);
  if (open !== 0) return open;
  if (a.openedAt !== b.openedAt) return a.openedAt < b.openedAt ? 1 : -1;
  return a.ticket < b.ticket ? -1 : 1;
}

function item(
  record: KeyedRecord,
  entries: readonly { readonly ticket?: string }[] | undefined,
): AttemptItem {
  const data = record.file.data;
  return {
    ticket: record.ticket,
    loop: record.loop,
    target: record.target,
    attempt: record.attempt,
    of: data.of,
    scope: record.scope,
    openedAt: record.openedAt,
    ...(data["closed-at"] === undefined ? {} : { closedAt: data["closed-at"] }),
    ...(record.outcome === undefined ? {} : { outcome: record.outcome }),
    ...(record.escalation === true ? { escalation: true } : {}),
    ...(entries === undefined
      ? {}
      : { entries: entries.filter((entry) => entry.ticket === record.ticket).length }),
  };
}
