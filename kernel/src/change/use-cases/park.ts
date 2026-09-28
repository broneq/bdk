// `bdk change park`: writes the park question (`park: true`, the options,
// `source: kernel`), then runs the checkpoint and reports it; a skipped
// checkpoint never fails the park (T22 design D-11).
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { listEntries, openAttempts, parkedQuestion } from "../../shared/store/index.ts";
import { DEFAULT_PARK_OPTIONS, DEFAULT_PARK_REASON, resumeCommand } from "../domain/change.ts";
import type { ParkReport } from "../domain/change.ts";
import { implicitCheckpoint, resolvedSettings } from "./checkpoint.ts";
import type { ChangeDeps } from "./deps.ts";

const TEXT_MAX = 120;

export function parkChange(
  deps: ChangeDeps,
  change: ActiveChange,
  globalDir: string,
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
  const settings = resolvedSettings(deps, change, globalDir);
  if (isRefusal(settings)) return Promise.resolve(settings);
  return withChangeIndex(deps, change, async (index) => {
    const tickets = openAttempts(index, change.id);
    if (tickets.length > 0) {
      const list = tickets.map((ticket) => ticket.ticket).join(", ");
      return refuse("policy/ticket-open", `${list} still open in ${change.id}`, [
        "bdk attempt close <ticket> <outcome>",
        "bdk attempt close <ticket> not-run",
      ]);
    }
    const parked = parkedQuestion(listEntries(index, change.id));
    if (parked !== undefined) {
      return refuse("policy/invalid-transition", `${change.id} is already parked on ${parked.id}`, [
        resumeCommand(change.id),
        "bdk change status",
      ]);
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
      checkpoint: await implicitCheckpoint(deps, change, settings),
    };
  });
}
