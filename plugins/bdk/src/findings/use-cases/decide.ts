import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { decisionEvent } from "../domain/events.ts";
import { problem } from "../domain/problem.ts";
import type { DecideResult } from "../schema/decide.ts";
import { appendEvent } from "../store/log.ts";
import { requireFinding } from "./known.ts";

export interface DecideInput {
  readonly log: string;
  readonly id: string;
  readonly decision: string;
  readonly issue?: string | undefined;
  readonly reason?: string | undefined;
}

/** Appends a `decision` event for a finding of the log. */
export function decide(files: Files, { log, ...input }: DecideInput): DecideResult {
  const parsed = decisionEvent.safeParse({ type: "decision", ...input });
  if (!parsed.success) {
    throw new CliError(
      "usage/invalid-argument",
      problem(parsed.error),
      "Run bdk findings decide --help.",
    );
  }
  requireFinding(files, log, parsed.data.id);
  appendEvent(files, log, parsed.data);
  const { id, decision, issue } = parsed.data;
  return { id, decision, ...(issue === undefined ? {} : { issue }) };
}
