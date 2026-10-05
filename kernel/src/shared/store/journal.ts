// The run journal (`kernel-state`, Run journal): one line per kernel command
// and per hook event under `.bdk/.machine/telemetry/journal.jsonl`, never
// committed. It holds pointers to host transcripts, never their content.
//
// Parallel agents append at once: each line is one O_APPEND write below 4 KiB,
// so lines stay whole. Only the halving rewrite takes the lock, and it replaces
// the file in one rename, so a reader never sees a cut line; an append that
// lands during that rewrite can be lost, which a bounded journal accepts.
import { join } from "node:path";
import * as z from "zod";

import { JOURNAL_VALUE_CHARS } from "../vocabulary/index.ts";
import { processLockWait, withLock } from "./lock.ts";
import type { LockWait } from "./lock.ts";
import type { Store } from "./store.ts";
import { halveTelemetry, telemetryPath } from "./telemetry.ts";

export const JOURNAL_LIMIT_BYTES = 1024 * 1024;
export const JOURNAL_LINE_BYTES = 4096;

const at = z.iso.datetime().meta({ description: "When the event happened, ISO 8601 UTC." });
const session = z
  .string()
  .nullable()
  .meta({ description: "The host session id, or null when the payload has none." });
const agent = z.string().min(1).meta({ description: "The host agent id, or `main`." });
const transcript = z
  .string()
  .nullable()
  .meta({ description: "Path of the host transcript file; never its content." });

const commandFields = {
  v: z.literal(1),
  at,
  command: z
    .string()
    .min(1)
    .meta({ description: "The record id from the command index, or `unknown`." }),
  args: z
    .array(z.string().max(JOURNAL_VALUE_CHARS))
    .readonly()
    .meta({
      description: `The arguments after the verb, each cut to ${JOURNAL_VALUE_CHARS} characters; a trailing "..." marks dropped ones.`,
    }),
  exit: z.int().meta({ description: "The exit code." }),
  rule: z.string().nullable().meta({ description: "The refusal rule, or null." }),
  ticket: z.string().nullable().meta({ description: "The --ticket flag or ticket positional." }),
  change: z.string().nullable().meta({ description: "The active Change id, when resolved." }),
  ms: z.int().min(0).meta({ description: "Wall time of the command." }),
};

export const journalLine = z
  .discriminatedUnion("kind", [
    z.strictObject({ ...commandFields, kind: z.literal("command") }),
    z.strictObject({ ...commandFields, kind: z.literal("guard"), agent }),
    z.strictObject({
      v: z.literal(1),
      kind: z.literal("session"),
      at,
      session: z.string().min(1),
      transcript,
      source: z.string().nullable().meta({ description: "The payload's `source`." }),
      bdk: z.string().min(1).meta({ description: "The BDK version." }),
      commit: z.string().nullable().meta({ description: "The BDK commit, when known." }),
      host: z
        .string()
        .nullable()
        .meta({ description: "The host version, when the payload has it." }),
    }),
    z.strictObject({
      v: z.literal(1),
      kind: z.literal("agent-start"),
      at,
      agent,
      type: z.string().min(1),
      parent: z.string().nullable(),
      ticket: z.string().nullable(),
      session,
    }),
    z.strictObject({
      v: z.literal(1),
      kind: z.literal("agent-stop"),
      at,
      agent,
      transcript,
      by: z.enum(["subagent-stop", "agent-result", "task-stop"]),
      session,
    }),
    z.strictObject({
      v: z.literal(1),
      kind: z.literal("question"),
      at,
      agent,
      count: z.int().min(1),
      session,
    }),
  ])
  .meta({
    title: "Run journal line",
    description: "One line of .bdk/.machine/telemetry/journal.jsonl (kernel-state, Run journal).",
  });

export type JournalLine = z.infer<typeof journalLine>;

export interface JournalOptions {
  readonly limit?: number;
  readonly wait?: LockWait;
}

export function journalPath(projectRoot: string): string {
  return telemetryPath(projectRoot, "journal");
}

/**
 * Appends one line; never creates `.bdk/` and never throws, so a journal that
 * cannot be written leaves the caller's output and exit code unchanged.
 */
export async function appendJournal(
  store: Store,
  projectRoot: string,
  line: JournalLine,
  options: JournalOptions = {},
): Promise<void> {
  try {
    if (!store.isDirectory(join(projectRoot, ".bdk"))) return;
    const path = journalPath(projectRoot);
    store.append(path, `${serialise(line)}\n`);
    const limit = options.limit ?? JOURNAL_LIMIT_BYTES;
    if ((store.stat(path)?.size ?? 0) < limit) return;
    // A busy lock means another process halves now; this append is then within its bound.
    await withLock(
      store,
      join(projectRoot, ".bdk", ".machine", "journal.lock"),
      "journal",
      options.wait ?? { ...processLockWait(), waitMs: 2_000, pollMs: 20 },
      () => {
        if ((store.stat(path)?.size ?? 0) >= limit) halveTelemetry(store, path);
        return Promise.resolve();
      },
    );
  } catch {
    // The journal is diagnostics: losing a line never fails the command.
  }
}

/** The line as JSON, with each argument cut and trailing arguments dropped past 4 KiB. */
function serialise(line: JournalLine): string {
  if (line.kind !== "command" && line.kind !== "guard") return JSON.stringify(line);
  const args = line.args.map((arg) => arg.slice(0, JOURNAL_VALUE_CHARS));
  let text = JSON.stringify({ ...line, args });
  while (Buffer.byteLength(text) + 1 > JOURNAL_LINE_BYTES && args.length > 1) {
    // The last argument becomes the "..." marker, then each step drops the one before it.
    if (args.at(-1) === "...") args.splice(-2, 1);
    else args[args.length - 1] = "...";
    text = JSON.stringify({ ...line, args });
  }
  return text;
}
