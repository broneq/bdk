import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { findingEvent } from "../domain/events.ts";
import { findingId } from "../domain/id.ts";
import { problem } from "../domain/problem.ts";
import type { AddResult } from "../schema/add.ts";
import { appendEvent } from "../store/log.ts";

export interface AddInput {
  readonly log: string;
  readonly source: string;
  readonly summary: string;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
  readonly rule?: string | undefined;
  readonly evidence?: string | undefined;
}

/** Appends a `finding` event with the id stamped from its dedupe key. */
export function addFinding(files: Files, input: AddInput): AddResult {
  const { log, ...finding } = input;
  const parsed = findingEvent.safeParse({ type: "finding", id: findingId(finding), ...finding });
  if (!parsed.success) {
    throw new CliError(
      "usage/invalid-argument",
      problem(parsed.error),
      "Run bdk findings add --help.",
    );
  }
  appendEvent(files, log, parsed.data);
  return { id: parsed.data.id };
}
