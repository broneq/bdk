// The committed attempt records as the ladder reads them, and the policy
// values it counts against. Records are read from the files, never from the
// index, so a fresh clone gives the same counts.
import { budgetsModule, escalationModule, oscillationModule } from "../config.ts";
import type { LadderPolicy, LadderRecord } from "../domain/ladder.ts";
import { moduleValue } from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import { readAttempts } from "../../shared/store/index.ts";
import type { AttemptFile, Store } from "../../shared/store/index.ts";
import type { Loop } from "../../shared/vocabulary/index.ts";

export interface KeyedRecord extends LadderRecord {
  readonly loop: Loop;
  readonly target: string;
  readonly file: AttemptFile;
}

export function keyedRecords(store: Store, changeDir: string): KeyedRecord[] {
  return readAttempts(store, changeDir).map((file) => {
    const data = file.data;
    return {
      ticket: data.ticket,
      loop: data.loop,
      target: data.target,
      attempt: data.attempt,
      scope: data.scope,
      escalation: data.escalation,
      openedAt: data["opened-at"],
      outcome: data.outcome,
      fingerprints: (data.findings ?? []).map((finding) => finding.fingerprint),
      after: data.after,
      file,
    };
  });
}

export function ofKey(
  records: readonly KeyedRecord[],
  loop: string,
  target: string,
): KeyedRecord[] {
  return records.filter((record) => record.loop === loop && record.target === target);
}

/** Escalation tickets of the whole Change that are open or closed `ok` or `fail`. */
export function escalationsOf(records: readonly KeyedRecord[]): number {
  return records.filter((record) => record.escalation === true && record.outcome !== "not-run")
    .length;
}

export function ladderPolicy(settings: Readonly<Mapping>, loop: Loop): LadderPolicy {
  const budgets = moduleValue(budgetsModule, settings);
  const escalation = moduleValue(escalationModule, settings);
  return {
    budget: budgets[loop],
    notRunBudget: budgets["not-run"],
    threshold: moduleValue(oscillationModule, settings).threshold,
    escalation: {
      enabled: escalation.enabled,
      model: escalation.model,
      perChange: escalation["per-change"],
    },
  };
}

export function resumeCommand(changeId: string): string {
  return `bdk change resume ${changeId} --option <n>`;
}
