// `bdk change park`: writes the park question (`park: true`, the options,
// `source: kernel`). The checkpoint commit lands with T22 (design D-14).
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { openAttempts } from "../../shared/store/index.ts";
import {
  CHECKPOINT_SKIPPED,
  DEFAULT_PARK_OPTIONS,
  DEFAULT_PARK_REASON,
  resumeCommand,
} from "../domain/change.ts";
import type { ParkReport } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";
import { changeFacts } from "./facts.ts";

const TEXT_MAX = 120;

export function parkChange(
  deps: ChangeDeps,
  change: ActiveChange,
  input: { readonly reason?: string | undefined; readonly options: readonly string[] },
): Promise<ParkReport | Refusal> {
  const summary = input.reason ?? DEFAULT_PARK_REASON;
  const options = input.options.length === 0 ? [...DEFAULT_PARK_OPTIONS] : [...input.options];
  const tooLong = [summary, ...options].find(
    (text) => text.trim() === "" || text.length > TEXT_MAX,
  );
  if (tooLong !== undefined) {
    return Promise.resolve(
      refuse(
        "input/invalid-argument",
        `"${tooLong}" must have 1 to ${TEXT_MAX} characters: it becomes an entry summary`,
        ["shorten --reason or --option"],
      ),
    );
  }
  return withChangeIndex(deps, change, async (index) => {
    const tickets = openAttempts(index, change.id);
    if (tickets.length > 0) {
      const list = tickets.map((ticket) => ticket.ticket).join(", ");
      return refuse("policy/ticket-open", `${list} still open in ${change.id}`, [
        "bdk attempt close <ticket> <outcome>",
        "bdk attempt close <ticket> not-run",
      ]);
    }
    const facts = changeFacts(index, change.id);
    if (facts.parked !== undefined) {
      return refuse(
        "policy/invalid-transition",
        `${change.id} is already parked on ${facts.parked.id}`,
        [resumeCommand(change.id), "bdk change status"],
      );
    }
    const entry = await appendEntry(
      deps,
      change,
      index,
      { type: "question", summary, refs: ["change.md"], body: "", options, park: true },
      { dedupe: false },
    );
    if ("refused" in entry) return entry;
    return {
      change: change.id,
      entry: entry.entry.id,
      options,
      resume: resumeCommand(change.id),
      checkpoint: { done: false, skipped: CHECKPOINT_SKIPPED },
    };
  });
}
