import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { levelEvent } from "../domain/events.ts";
import { problem } from "../domain/problem.ts";
import type { LevelResult } from "../schema/level.ts";
import { appendEvent } from "../store/log.ts";
import { requireFinding } from "./known.ts";

export interface LevelInput {
  readonly log: string;
  readonly id: string;
  readonly level: string;
  readonly reason?: string | undefined;
}

/** Appends a `level` event for a finding of the log. */
export function setLevel(files: Files, { log, ...input }: LevelInput): LevelResult {
  const parsed = levelEvent.safeParse({ type: "level", ...input });
  if (!parsed.success) {
    throw new CliError(
      "usage/invalid-argument",
      problem(parsed.error),
      "Run bdk findings level --help.",
    );
  }
  requireFinding(files, log, parsed.data.id);
  appendEvent(files, log, parsed.data);
  return { id: parsed.data.id, level: parsed.data.level };
}
