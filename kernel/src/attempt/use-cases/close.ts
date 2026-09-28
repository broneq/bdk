// `bdk attempt close <ticket> ok|fail|not-run` (`kernel-cli/attempt`; T22
// design D-3, D-4, D-9): the diff check, the envelope's entries, the
// fingerprints of a `fail`, then the record is closed in place and the next
// rung returned. At the end of the ladder the kernel writes the ladder
// question, which parks the Change, and runs the checkpoint.
import { isAbsolute, join } from "node:path";

import {
  currentRound,
  escalationBlocked,
  ladderOptions,
  nextRung,
  refLocation,
  roundState,
} from "../domain/ladder.ts";
import type { Next, Outcome } from "../domain/ladder.ts";
import type { AttemptCloseReport, DiffReport } from "../domain/reports.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { diffCheck } from "../../part/index.ts";
import type { DiffTarget } from "../../part/index.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  checkpointChange,
  findingFingerprint,
  listEntries,
  readDocument,
  readPlanParts,
  taskHolders,
  writeDocument,
} from "../../shared/store/index.ts";
import type { AttemptRecord, EntryRow, IndexDb } from "../../shared/store/index.ts";
import type { AttemptDeps } from "./deps.ts";
import { escalationsOf, keyedRecords, ladderPolicy, ofKey, resumeCommand } from "./records.ts";
import type { KeyedRecord } from "./records.ts";

const OUTCOMES: readonly string[] = ["ok", "fail", "not-run"];
const SUMMARY_MAX = 120;

export interface CloseInput {
  readonly ticket: string;
  readonly outcome: string;
  /** As typed: relative to `cwd` unless absolute. */
  readonly envelope?: string | undefined;
  readonly reason?: string | undefined;
}

export interface CloseWhere {
  readonly cwd: string;
  readonly globalDir: string;
}

type Finding = NonNullable<AttemptRecord["findings"]>[number];

export function closeAttempt(
  deps: AttemptDeps,
  change: ActiveChange,
  where: CloseWhere,
  input: CloseInput,
): Promise<AttemptCloseReport | Refusal> {
  if (!OUTCOMES.includes(input.outcome)) {
    return Promise.resolve(
      refuse("input/invalid-argument", `outcome ${input.outcome} is not ok, fail or not-run`, [
        `bdk attempt close ${input.ticket} ok|fail|not-run`,
      ]),
    );
  }
  const outcome = input.outcome as Outcome;
  const reason = input.reason?.trim() ?? "";
  if (outcome === "not-run" && reason === "") {
    return Promise.resolve(
      refuse("input/missing-argument", "not-run needs --reason naming the missing precondition", [
        `bdk attempt close ${input.ticket} not-run --reason "<what was missing>"`,
      ]),
    );
  }
  return withChangeIndex(deps, change, async (index) => {
    const records = keyedRecords(deps.store, change.dir);
    const record = records.find((found) => found.ticket === input.ticket);
    if (record === undefined) {
      return refuse("input/not-found", `${change.id} has no ticket ${input.ticket}`, [
        "bdk attempt list --all",
      ]);
    }
    if (record.outcome !== undefined) {
      return refuse(
        "policy/no-open-ticket",
        `ticket ${input.ticket} is already closed ${record.outcome}`,
        [`bdk attempt open ${record.loop} ${record.target}`, "bdk attempt list"],
      );
    }
    const resolved = resolveOrRefuse(
      {
        store: deps.store,
        settings: deps.settings,
        globalDir: where.globalDir,
        projectRoot: change.projectRoot,
        pluginRoot: deps.pluginRoot,
      },
      { removed: "ignore" },
    );
    if ("refused" in resolved) return resolved;

    const diff = await diffCheck(deps, change, index, diffTarget(record));
    if ("refused" in diff) return diff;
    const underTicket = listEntries(index, change.id).filter(
      (entry) => entry.ticket === input.ticket,
    );
    if (input.envelope !== undefined) {
      const missing = missingEntries(deps, where.cwd, input.envelope, underTicket);
      if (missing !== undefined) return missing;
    }

    const findings = outcome === "fail" ? fingerprints(underTicket) : [];
    const kernelFindings: string[] = [];
    if (diff.undeclared.length > 0) {
      const written = await recordUndeclared(deps, change, index, record.target, diff.undeclared);
      if ("refused" in written) return written;
      kernelFindings.push(written.id);
    }
    writeDocument(deps.store, record.file.path, {
      data: {
        ...record.file.data,
        "closed-at": deps.clock.now(),
        outcome,
        ...(findings.length === 0 ? {} : { findings }),
      },
      body: reason === "" ? record.file.body : `${reason}\n`,
    });

    const after = keyedRecords(deps.store, change.dir);
    const entries = listEntries(index, change.id);
    const policy = ladderPolicy(resolved.value, record.loop);
    const round = currentRound(ofKey(after, record.loop, record.target), entries);
    const state = roundState(round, policy);
    const blocked = escalationBlocked(state, policy, escalationsOf(after));
    const rung = nextRung(outcome, record.escalation === true, state, policy, blocked);
    const next =
      rung.action === "parked"
        ? await park(deps, change, index, resolved.value, record, round, rung)
        : rung;
    if ("refused" in next) return next;

    const prints = [...new Set(findings.map((finding) => finding.fingerprint))];
    return {
      ticket: input.ticket,
      outcome,
      ...(isChecked(record) ? { diff: diffReport(diff) } : {}),
      ...(kernelFindings.length === 0 ? {} : { findings: kernelFindings }),
      ...(prints.length === 0 ? {} : { fingerprints: prints }),
      notRunCount: state.notRun,
      next,
    };
  });
}

function diffTarget(record: KeyedRecord): DiffTarget {
  switch (record.loop) {
    case "task-redispatch":
      return { task: record.target };
    case "verify-fix":
      return { part: record.target };
    case "review-fix":
      return { change: true };
    case "verifier":
      return { verifier: true };
  }
}

function isChecked(record: KeyedRecord): boolean {
  return record.loop !== "verifier";
}

function diffReport(diff: DiffReport): DiffReport {
  return { declared: diff.declared, touched: diff.touched, undeclared: diff.undeclared };
}

/** `policy/entries-missing` naming the envelope's ids that were not written under the ticket. */
function missingEntries(
  deps: AttemptDeps,
  cwd: string,
  envelope: string,
  underTicket: readonly EntryRow[],
): Refusal | undefined {
  const path = isAbsolute(envelope) ? envelope : join(cwd, envelope);
  const document = deps.store.read(path) === undefined ? undefined : readDocument(deps.store, path);
  if (document === undefined || !("data" in document) || document.kind !== "report") {
    return refuse("input/not-found", `no report envelope at ${envelope}`, [
      "--envelope .bdk/changes/<id>/reports/<target>-<role>-<ticket>.md",
    ]);
  }
  const written = new Set(underTicket.map((entry) => entry.id));
  const declared = (document.data.entries ?? []) as readonly string[];
  const missing = declared.filter((id) => !written.has(id));
  if (missing.length === 0) return undefined;
  return refuse(
    "policy/entries-missing",
    `the envelope declares ${missing.join(", ")}, which ${missing.length === 1 ? "was" : "were"} not written under this ticket`,
    ["bdk log add ... --ticket <ticket>", "bdk log ingest --ticket <ticket>"],
  );
}

/** The fingerprints of the ticket's `finding` and `blocker` entries that have a location. */
function fingerprints(underTicket: readonly EntryRow[]): Finding[] {
  const found: Finding[] = [];
  for (const entry of underTicket) {
    if (entry.type !== "finding" && entry.type !== "blocker") continue;
    const location = refLocation(entry.refs);
    if (location === undefined) continue;
    found.push({
      fingerprint: findingFingerprint(entry.type, location.file, location.symbol, entry.summary),
      type: entry.type,
      file: location.file,
      ...(location.symbol === undefined ? {} : { symbol: location.symbol }),
    });
  }
  return found;
}

async function recordUndeclared(
  deps: AttemptDeps,
  change: ActiveChange,
  index: IndexDb,
  target: string,
  paths: readonly string[],
): Promise<{ readonly id: string } | Refusal> {
  const count = paths.length;
  const written = await appendEntry(
    deps,
    change,
    index,
    {
      type: "finding",
      summary:
        `${target} changed ${String(count)} file${count === 1 ? "" : "s"} its plan does not declare`.slice(
          0,
          SUMMARY_MAX,
        ),
      status: "proposed",
      refs: [target, ...paths],
      body: `${paths.map((path) => `- ${path}`).join("\n")}\n`,
    },
    { dedupe: true },
  );
  return "refused" in written ? written : { id: written.entry.id };
}

/** The end of the ladder: the question that parks the Change, then the checkpoint. */
async function park(
  deps: AttemptDeps,
  change: ActiveChange,
  index: IndexDb,
  settings: Readonly<Mapping>,
  record: KeyedRecord,
  round: readonly KeyedRecord[],
  rung: Next,
): Promise<AttemptCloseReport["next"] | Refusal> {
  const part =
    record.loop === "verify-fix"
      ? record.target
      : record.loop === "task-redispatch"
        ? taskHolders(readPlanParts(deps.store, change.dir)).get(record.target)?.id
        : undefined;
  const written = await appendEntry(
    deps,
    change,
    index,
    {
      type: "question",
      summary: `${record.loop} ${record.target} reached the end of its ladder; how to go on?`.slice(
        0,
        SUMMARY_MAX,
      ),
      status: "proposed",
      review: true,
      park: true,
      options: ladderOptions(record.target, part),
      refs: [record.target, ...round.map((item) => item.ticket)],
      body: `${rung.why ?? "the ladder ended"}.\n`,
    },
    { dedupe: false },
  );
  if ("refused" in written) return written;
  await checkpointChange({
    store: deps.store,
    git: deps.git,
    projectRoot: change.projectRoot,
    change,
    settings,
  });
  return {
    action: "parked",
    entry: written.entry.id,
    ...(rung.why === undefined ? {} : { why: rung.why }),
    resume: resumeCommand(change.id),
  };
}
