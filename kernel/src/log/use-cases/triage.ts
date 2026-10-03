// `bdk log triage <id> <level>` (`kernel-cli/log`; T42-T): the orchestrator's
// judgement of what a finding, blocker or observation means for this project,
// written in place as `level` with a triage line appended to the body
// (`kernel-state`, Derived state and mutation). `not-a-problem` also resolves
// the entry, so it stops being live in the same write.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { findEntry, readDocument, writeDocument } from "../../shared/store/index.ts";
import { withTriage } from "../domain/entry.ts";
import type { TriageResult } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

const TRIAGED_TYPES: readonly string[] = ["finding", "blocker", "observation"];
const LIVE: readonly string[] = ["proposed", "accepted"];
const NOT_A_PROBLEM = "not-a-problem";

export interface TriageInput {
  readonly id: string;
  readonly level: string;
  readonly reason?: string;
}

export function triageEntry(
  deps: LogDeps,
  change: ActiveChange,
  input: TriageInput,
): Promise<TriageResult | Refusal> {
  if (input.level === NOT_A_PROBLEM && input.reason === undefined) {
    return Promise.resolve(
      refuse(
        "input/missing-argument",
        "not-a-problem needs --reason: why the entry is no problem",
        [`bdk log triage ${input.id} not-a-problem --reason <text>`],
      ),
    );
  }
  return withChangeIndex(deps, change, (index) => {
    const id = input.id.startsWith(`${change.id}/`)
      ? input.id.slice(change.id.length + 1)
      : input.id;
    const entry = findEntry(index, change.id, id);
    if (entry === undefined) {
      return refuse("input/not-found", `${input.id} names no entry of ${change.id}`, [
        "bdk log list",
      ]);
    }
    if (!TRIAGED_TYPES.includes(entry.type)) {
      return refuse(
        "input/invalid-argument",
        `${entry.id} is a ${entry.type}; triage applies to ${TRIAGED_TYPES.join(", ")}`,
        ["bdk log list --type finding"],
      );
    }
    if (!LIVE.includes(entry.status)) {
      return refuse(
        "policy/invalid-transition",
        `${entry.id} is ${entry.status}; only a live entry is triaged`,
        [`bdk log show ${entry.id}`],
      );
    }
    const path = join(change.projectRoot, entry.path);
    const document = readDocument(deps.store, path);
    if (document === undefined || !("data" in document)) {
      return refuse("input/not-found", `${input.id} names no entry of ${change.id}`, [
        "bdk log list",
      ]);
    }
    const status = input.level === NOT_A_PROBLEM ? "resolved" : entry.status;
    writeDocument(deps.store, path, {
      data: { ...document.data, level: input.level, status },
      body: withTriage(document.body, input.level, deps.clock.now(), input.reason),
    });
    return { record: entry.id, level: input.level, status };
  });
}
