// `bdk attempt close <ticket> ok|fail|not-run` (`kernel-cli/attempt`; T22
// design D-3, D-4, D-9; T23-D41): the diff check, the envelope's entries,
// the post-task step evidence of an `ok` code ticket, the fingerprints of a
// `fail`, then the record is closed in place and the next rung returned. At the end of the ladder the kernel writes the ladder
// question, which parks the Change, and runs the checkpoint. A `review-fix` round closes
// `ok` or `fail` only once its merged review is stored (T42).
import { isAbsolute, join } from "node:path";

import {
  currentRound,
  escalationBlocked,
  ladderOptions,
  nextRung,
  refLocation,
  roundState,
} from "../domain/ladder.ts";
import type { Next, OkAction, Outcome } from "../domain/ladder.ts";
import type { AttemptCloseReport, DiffReport } from "../domain/reports.ts";
import { closeEvidence } from "../../evidence/index.ts";
import { targetSteps } from "../../graph/index.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { commitMergeTicket, diffCheck, unresolvedMerge } from "../../part/index.ts";
import type { DiffTarget } from "../../part/index.ts";
import { resolveOrRefuse } from "../../shared/config/index.ts";
import type { Mapping, Resolved } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  checkpointChange,
  findingFingerprint,
  listEntries,
  mergeReportName,
  readDocument,
  readPlanParts,
  taskHolders,
  packageRoles,
  partWorktree,
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

    const diff = await diffCheck(deps, change, index, diffTarget(change, record));
    if ("refused" in diff) return diff;
    const underTicket = listEntries(index, change.id).filter(
      (entry) => entry.ticket === input.ticket,
    );
    if (input.envelope !== undefined) {
      const missing = missingEntries(deps, where.cwd, input.envelope, underTicket);
      if (missing !== undefined) return missing;
    }

    if (outcome !== "not-run" && record.loop === "review-fix") {
      const unmerged = missingMerge(deps, change, record);
      if (unmerged !== undefined) return unmerged;
    }

    if (outcome === "ok" && record.loop === "part-lead") {
      const open = records.find(
        (found) =>
          found.outcome === undefined &&
          found.ticket !== record.ticket &&
          (found.target === record.target || found.target.startsWith(`${record.target}-`)),
      );
      if (open !== undefined) {
        return refuse(
          "policy/ticket-open",
          `ticket ${open.ticket} of ${open.target} in part ${record.target} is still open; a lead closes ok only after every task ticket of its part`,
          [`bdk attempt close ${open.ticket} ok|fail|not-run`],
        );
      }
    }
    const conflicts = record.file.data.conflicts;
    if (outcome === "ok" && conflicts !== undefined) {
      const unresolved = await unresolvedMerge(deps, change, record.target, conflicts);
      if (unresolved !== undefined) return unresolved;
    }
    if (outcome === "ok") {
      const unproven = await stepEvidence(deps, change, index, where.globalDir, record, resolved);
      if (unproven !== undefined) return unproven;
    }
    if (outcome === "ok" && conflicts !== undefined) {
      const rejected = await commitMergeTicket(deps, change, record.target, [
        ...conflicts,
        ...diff.declared,
      ]);
      if (rejected !== undefined) return rejected;
    }

    const findings = outcome === "fail" ? fingerprints(underTicket) : [];
    const kernelFindings: string[] = [];
    if (diff.undeclared.length > 0) {
      const written = await recordUndeclared(deps, change, index, record.target, diff.undeclared);
      if ("refused" in written) return written;
      kernelFindings.push(written.id);
    }
    const rulesFinding = await unreadRules(deps, change, index, record);
    if (rulesFinding !== undefined && "refused" in rulesFinding) return rulesFinding;
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
    const rung = nextRung(
      outcome,
      record.escalation === true,
      state,
      policy,
      blocked,
      okAction(record),
    );
    // The kernel committed the merge ticket's work: nothing is left to commit.
    const next =
      rung.action === "parked"
        ? await park(deps, change, index, resolved.value, record, round, rung)
        : rung.action === "commit" && conflicts !== undefined
          ? { ...rung, action: "part-done" as const }
          : rung;
    if ("refused" in next) return next;

    const prints = [...new Set(findings.map((finding) => finding.fingerprint))];
    return {
      ticket: input.ticket,
      outcome,
      ...(isChecked(record) ? { diff: diffReport(diff) } : {}),
      ...(kernelFindings.length === 0 ? {} : { findings: kernelFindings }),
      ...(prints.length === 0 ? {} : { fingerprints: prints }),
      ...(rulesFinding === undefined ? {} : { rulesFinding: rulesFinding.id }),
      notRunCount: state.notRun,
      next,
    };
  });
}

/**
 * The post-task step evidence of an `ok` close of a code ticket, one that
 * holds an `implementer` or a `simplifier` package (T23-D41; a `verify-fix`
 * ticket rerunning a done part's steps has no implementer); undefined when it
 * holds or the ticket is no code ticket.
 */
async function stepEvidence(
  deps: AttemptDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  record: KeyedRecord,
  resolved: Resolved,
): Promise<Refusal | undefined> {
  const roles = packageRoles(deps.store, change.dir, record.ticket);
  if (!roles.includes("implementer") && !roles.includes("simplifier")) return undefined;
  const steps = await targetSteps(deps, change, index, globalDir, record.target);
  if ("refused" in steps) return steps;
  return closeEvidence(deps, change, globalDir, {
    ticket: record.ticket,
    target: record.target,
    steps: steps.steps,
    notRunBudget: ladderPolicy(resolved.value, record.loop).notRunBudget,
  });
}

/** What remains after an `ok` close: the task's commit, the lead's `part done`, the round's `done review`. */
function okAction(record: KeyedRecord): OkAction {
  if (record.loop === "part-lead") return "part-done";
  return record.loop === "review-fix" ? "review-done" : "commit";
}

/**
 * A review round is judged by its merged review (T42-B1): closed without it,
 * the round's triage would reach no report, and the closed ticket refuses the
 * merge afterwards. A `not-run` round reviewed nothing and needs none.
 */
function missingMerge(
  deps: AttemptDeps,
  change: ActiveChange,
  record: KeyedRecord,
): Refusal | undefined {
  const report = join(change.dir, "reports", mergeReportName(record.target, record.ticket));
  if (deps.store.read(report) !== undefined) return undefined;
  return refuse(
    "policy/missing-report",
    `${record.ticket} has no merged review; a review round closes ok or fail after it`,
    [
      `bdk log ingest --ticket ${record.ticket}@merge`,
      `bdk log add report "<counts per level>" --ticket ${record.ticket}@merge`,
      `bdk attempt close ${record.ticket} not-run --reason "<why the round reviewed nothing>"`,
    ],
  );
}

function diffTarget(change: ActiveChange, record: KeyedRecord): DiffTarget {
  const conflicts = record.file.data.conflicts;
  switch (record.loop) {
    case "task-redispatch":
      return { task: record.target };
    case "verify-fix":
      return conflicts === undefined
        ? { part: record.target }
        : { part: record.target, merge: { ref: change.branch, conflicts } };
    case "part-lead":
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

/**
 * A ticket with an `implementer` package closed without the implementer's
 * `rules show --ticket` (T23-D28, D42, risk R2): one reviewed kernel finding;
 * the close goes on. Undefined when the rules were read or no implementer ran.
 */
async function unreadRules(
  deps: AttemptDeps,
  change: ActiveChange,
  index: IndexDb,
  record: KeyedRecord,
): Promise<{ readonly id: string } | Refusal | undefined> {
  if (!packageRoles(deps.store, change.dir, record.ticket).includes("implementer")) {
    return undefined;
  }
  if (record.file.data["rules-read"] !== undefined) return undefined;
  const written = await appendEntry(
    deps,
    change,
    index,
    {
      type: "finding",
      summary: `implementer closed ${record.ticket} without reading its rules`,
      status: "proposed",
      review: true,
      refs: [record.target, record.ticket],
      body: `The attempt record has no rules-read: \`bdk rules show --ticket ${record.ticket}\` never ran.\n`,
    },
    { dedupe: true },
  );
  return "refused" in written ? written : { id: written.entry.id };
}

/** The park question's way back from a merge ticket: the worktree, the paths, the abort. */
async function mergeWayBack(
  deps: AttemptDeps,
  change: ActiveChange,
  record: KeyedRecord,
): Promise<string> {
  const conflicts = record.file.data.conflicts;
  if (conflicts === undefined) return "";
  const workdir = await partWorktree(deps.git, deps.store, change, record.target);
  return `\nThe merge of ${change.branch} into part ${record.target} is still in progress in ${workdir ?? "its worktree"}, conflicting in ${conflicts.join(", ")}. Resolve it there by hand, or run \`git merge --abort\` in that worktree to drop it.\n`;
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
    record.loop === "verify-fix" || record.loop === "part-lead"
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
      body: `${rung.why ?? "the ladder ended"}.\n${await mergeWayBack(deps, change, record)}`,
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
