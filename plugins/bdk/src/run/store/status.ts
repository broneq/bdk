// The files `bdk run status` reads (spec `bdk-cli/run`, "Files the derivation reads"): the
// schemas of `run.json` and `state.json`, and the snapshot of each queued Change. Read only.

import { join } from "node:path";
import { z } from "zod";

import { CliError } from "../../shared/cli/index.ts";
import type { Entry, Files } from "../../shared/fs/index.ts";
import { mergeParts, MODES, PART_STATUSES, passes } from "../domain/status.ts";
import type { ChangeSnapshot, Mode, Part, Report, Round } from "../domain/status.ts";

export const RUNS_DIR = ".bdk/runs";
const CHANGES_DIR = "openspec/changes";

/** OpenSpec rejects capitals, and a name is joined into paths: no dots, no separators. */
const changeName = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must match ^[a-z0-9][a-z0-9-]*$");

const runFile = z
  .object({
    version: z.literal(1),
    mode: z.enum(MODES),
    queue: z
      .array(z.object({ change: changeName, issue: z.number().int().positive().optional() }))
      .min(1),
    current: changeName,
  })
  .superRefine((run, ctx) => {
    const seen = new Set<string>();
    run.queue.forEach(({ change }, i) => {
      if (seen.has(change))
        ctx.addIssue({ code: "custom", path: ["queue", i, "change"], message: "named twice" });
      seen.add(change);
    });
    if (!seen.has(run.current))
      ctx.addIssue({ code: "custom", path: ["current"], message: "names no queue entry" });
  });

const stateFile = z.object({
  version: z.literal(1),
  parts: z.record(
    z.string().regex(/^\d{2}$/, "a part id has two digits"),
    z.object({
      status: z.enum(PART_STATUSES),
      attempts: z.number().int().nonnegative(),
      reason: z.string().optional(),
    }),
  ),
});

export interface QueueEntry {
  readonly change: string;
  readonly issue: number | null;
}

export interface RunSnapshot {
  readonly mode: Mode;
  readonly current: string;
  readonly queue: readonly QueueEntry[];
  readonly changes: ReadonlyMap<string, ChangeFiles>;
}

function parse<T>(schema: z.ZodType<T>, file: string, text: string): T {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    throw new CliError(
      "env/invalid-run-state",
      `${file} is not valid JSON: ${why}`,
      `Fix ${file}; its writer owns it.`,
    );
  }
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const [issue] = result.error.issues;
  const key = issue?.path.map(String).join(".") ?? "";
  throw new CliError(
    "env/invalid-run-state",
    `${file}: ${key === "" ? "(root)" : key}: ${issue?.message ?? "invalid"}`,
    `Fix ${file}; its writer owns it.`,
  );
}

/** The numbers N of the entries named by `pattern`, ascending; N is written without leading zeros. */
function numbered(entries: readonly Entry[] | undefined, pattern: RegExp, dir: boolean): number[] {
  return (entries ?? [])
    .filter((entry) => entry.dir === dir)
    .flatMap((entry) => {
      const match = pattern.exec(entry.name);
      return match?.[1] === undefined ? [] : [Number(match[1])];
    })
    .sort((a, b) => a - b);
}

function has(entries: readonly Entry[] | undefined, name: string, dir = false): boolean {
  return (entries ?? []).some((entry) => entry.name === name && entry.dir === dir);
}

/** The active OpenSpec Change directory, else the latest archived one. */
function openspecDir(
  files: Files,
  cwd: string,
  change: string,
): { path: string; archived: boolean } | undefined {
  const active = join(CHANGES_DIR, change);
  if (files.list(join(cwd, active)) !== undefined) return { path: active, archived: false };
  const archived = (files.list(join(cwd, CHANGES_DIR, "archive")) ?? [])
    .filter((entry) => entry.dir && /^\d{4}-\d{2}-\d{2}-(.+)$/.exec(entry.name)?.[1] === change)
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  return archived === undefined
    ? undefined
    : { path: join(CHANGES_DIR, "archive", archived), archived: true };
}

function lastReport(files: Files, dir: string): Report | undefined {
  const last = numbered(files.list(dir), /^verify-([1-9]\d*)\.md$/, false).at(-1);
  if (last === undefined) return undefined;
  const name = `verify-${String(last)}.md`;
  return { name, pass: passes(files.readText(join(dir, name)) ?? "") };
}

/**
 * What the files of a Change say, but the findings: the store does not fold the log, the use
 * case asks the `findings` slice to. `lastLog` is the last round's log, relative to the root.
 */
export type ChangeFiles = Omit<ChangeSnapshot, "lastRound"> & {
  readonly lastLog: string | undefined;
};

function changeFiles(files: Files, cwd: string, change: string): ChangeFiles {
  const runDir = join(RUNS_DIR, change);
  const at = (...path: string[]): string => join(cwd, runDir, ...path);

  const found = openspecDir(files, cwd, change);
  const top = found === undefined ? undefined : files.list(join(cwd, found.path));
  const planIds = (
    found === undefined ? [] : (files.list(join(cwd, found.path, "plan", "parts")) ?? [])
  )
    .filter((entry) => !entry.dir)
    .flatMap((entry) => /^(\d{2})\.md$/.exec(entry.name)?.[1] ?? []);

  const stateName = join(runDir, "state.json");
  const stateText = files.readText(join(cwd, stateName));
  const states: Part[] =
    stateText === undefined
      ? []
      : Object.entries(parse(stateFile, stateName, stateText).parts).map(([id, part]) => ({
          id,
          status: part.status,
          attempts: part.attempts,
          reason: part.reason ?? null,
        }));

  const reviewDir = at("review");
  const rounds: Round[] = numbered(files.list(reviewDir), /^round-([1-9]\d*)$/, true).map((n) => ({
    n,
    report: has(files.list(join(reviewDir, `round-${String(n)}`)), "review.md"),
  }));
  const last = rounds.at(-1);
  const lastLog =
    last === undefined
      ? undefined
      : join(runDir, "review", `round-${String(last.n)}`, "findings.jsonl");

  const close = at("close");
  const conformance = files.readText(join(close, "spec-conformance.md"));
  return {
    openspec:
      found === undefined
        ? undefined
        : {
            archived: found.archived,
            proposal: has(top, "proposal.md"),
            design: has(top, "design.md"),
            planParts: planIds.length,
          },
    designVerify: lastReport(files, at("design")),
    planVerify: lastReport(files, at("plan")),
    parts: mergeParts(planIds, states),
    rounds,
    lastLog,
    specConformance: conformance === undefined ? undefined : passes(conformance),
    pr: has(files.list(close), "pr.md"),
  };
}

/** Reads `run.json` and every queued Change's files under `cwd`. */
export function readRun(files: Files, cwd: string): RunSnapshot {
  const runName = join(RUNS_DIR, "run.json");
  const text = files.readText(join(cwd, runName));
  if (text === undefined) {
    throw new CliError("env/no-run", `no run: ${runName} is missing`, "Start a run with /bdk:run.");
  }
  const run = parse(runFile, runName, text);
  const changes = new Map(run.queue.map(({ change }) => [change, changeFiles(files, cwd, change)]));
  return {
    mode: run.mode,
    current: run.current,
    queue: run.queue.map(({ change, issue }) => ({ change, issue: issue ?? null })),
    changes,
  };
}
