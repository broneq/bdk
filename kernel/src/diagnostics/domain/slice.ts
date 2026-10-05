// One bounded excerpt of an agent's transcript (`kernel-cli/diagnostics`, bdk
// diagnostics slice): the events around one point, tool results cut to 20
// lines, at most 200 lines in all.
import { eventLines } from "./log.ts";
import type { SliceReport } from "./report.ts";
import type { AgentTranscript } from "./transcript.ts";

export const SLICE_LIMIT = 100;
const SLICE_LINES = 200;

/** The index of the event a time or a transcript line points at; -1 when none. */
export function eventIndex(
  transcript: AgentTranscript,
  point: { readonly at: string } | { readonly line: number },
): number {
  const { events } = transcript;
  if ("line" in point) return events.findIndex((event) => event.line >= point.line);
  const index = events.findIndex((event) => event.at >= point.at);
  return index === -1 ? events.length - 1 : index;
}

export function sliceAround(
  transcript: AgentTranscript,
  index: number,
  before: number,
  after: number,
): SliceReport {
  const options = { full: false, kernelUses: new Set<string>() };
  const events = transcript.events.slice(Math.max(0, index - before), index + after + 1);
  const lines = events.flatMap((event) => eventLines(event, transcript.agent, "", options));
  return {
    agent: transcript.agent,
    at: transcript.events[index]?.at ?? "",
    events: lines.slice(0, SLICE_LINES),
    omitted: Math.max(0, lines.length - SLICE_LINES),
  };
}
