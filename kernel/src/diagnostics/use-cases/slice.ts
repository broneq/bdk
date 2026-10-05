// `bdk diagnostics slice` (`kernel-cli/diagnostics`): resolves a finding's
// cite to one agent and one point of its transcript and prints the events
// around it.
import { join } from "node:path";

import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { findChange, readDocument } from "../../shared/store/index.ts";
import { buildReport } from "../domain/build.ts";
import type { BuiltReport } from "../domain/build.ts";
import type { SliceReport } from "../domain/report.ts";
import { eventIndex, SLICE_LIMIT, sliceAround } from "../domain/slice.ts";
import { chooseSession, reportInput } from "./report.ts";
import type { DiagnosticsDeps, Place } from "./report.ts";

const LEDGER_ID = /^L-[0-9a-z]{8}$/;

export interface SliceChoice {
  readonly cite: string;
  readonly session?: string | undefined;
  readonly before: number;
  readonly after: number;
}

export async function diagnosticsSlice(
  deps: DiagnosticsDeps,
  place: Place,
  choice: SliceChoice,
  active: () => ActiveChange | Refusal,
): Promise<SliceReport | Refusal> {
  if (choice.before + choice.after > SLICE_LIMIT) {
    return refuse(
      "input/invalid-argument",
      `--before and --after together are at most ${String(SLICE_LIMIT)}`,
      [`bdk diagnostics slice ${choice.cite} --before 10 --after 10`],
    );
  }
  const chosen = chooseSession(deps, place, choice, active);
  if ("refused" in chosen) return chosen;
  const input = await reportInput(deps, place, chosen.journal, chosen.session, undefined);
  if ("refused" in input) return input;
  const built = buildReport(input);
  if ("missing" in built)
    return notFound(choice.cite, `session ${chosen.session} is not in the run journal`);
  const transcripts = input.transcripts.state === "ok" ? input.transcripts.agents : [];
  const point = resolveCite(deps, place, built, choice.cite);
  if ("refused" in point) return point;
  const transcript = transcripts.find((each) => each.agent === point.agent);
  if (transcript === undefined) {
    return notFound(choice.cite, `agent ${point.agent} has no readable transcript`);
  }
  const index = eventIndex(transcript, point);
  if (index === -1) return notFound(choice.cite, `the transcript of ${point.agent} ends before it`);
  return sliceAround(transcript, index, choice.before, choice.after);
}

type Point = { readonly agent: string } & ({ readonly at: string } | { readonly line: number });

function resolveCite(
  deps: DiagnosticsDeps,
  place: Place,
  built: BuiltReport,
  cite: string,
): Point | Refusal {
  const journal = /^journal:(\d+)$/.exec(cite);
  if (journal !== null) {
    const n = Number(journal[1]);
    const line = built.lines.find((each) => each.n === n);
    if (line === undefined)
      return notFound(cite, `journal line ${String(n)} is not a line of the session`);
    const attribution = built.attribution.get(n);
    if (attribution?.use) return { agent: attribution.use.agent, line: attribution.use.line };
    const agent = attribution?.agent ?? ("agent" in line ? line.agent : "main");
    return { agent: known(agent), at: line.at };
  }
  const transcript = /^(.+):(\d+)$/.exec(cite);
  if (transcript !== null) return { agent: transcript[1] ?? "", line: Number(transcript[2]) };
  if (LEDGER_ID.test(cite)) return ledgerPoint(deps, place, built, cite);
  return refuse(
    "input/invalid-argument",
    `${cite} is not a cite: journal:<line>, <agent-id>:<line> or a ledger id`,
    ["bdk diagnostics report --json"],
  );
}

/** A ledger entry: its time, and the agent holding its ticket (else the main thread). */
function ledgerPoint(
  deps: DiagnosticsDeps,
  place: Place,
  built: BuiltReport,
  id: string,
): Point | Refusal {
  const change =
    built.report.change === null
      ? undefined
      : findChange(deps.store, place.projectRoot, built.report.change);
  const dir = change === undefined ? undefined : join(change.dir, "log");
  const name =
    dir === undefined ? undefined : deps.store.list(dir).find((file) => file.endsWith(`-${id}.md`));
  const document =
    dir === undefined || name === undefined ? undefined : readDocument(deps.store, join(dir, name));
  if (document === undefined || !("data" in document))
    return notFound(id, `ledger entry ${id} is not in the session's Change`);
  const data = document.data as { at?: unknown; ticket?: unknown };
  const holder = built.agents.find(
    (agent) => agent.ticket !== null && agent.ticket === data.ticket,
  );
  return {
    agent: holder?.id ?? "main",
    at: typeof data.at === "string" ? data.at : built.report.from,
  };
}

/** A line attributed to no transcript agent is shown on the main thread. */
function known(agent: string): string {
  return agent === "unknown" || agent === "host" ? "main" : agent;
}

function notFound(cite: string, why: string): Refusal {
  return refuse("input/not-found", `${cite}: ${why}`, ["bdk diagnostics report --json"]);
}
