// The verdict kinds `design-verify`, `plan-verify` and `review`
// (`kernel-pipeline`, Artifact kinds; design D-4): the latest `report` naming
// the node must pass, be no older than the `done` of what it verifies
// (v3-t41-design D2), and no live blocker may name it. The report is read,
// never hashed. The `review` verdict also needs the merged report of a
// `review-fix` round closed `ok`, every entry of that round triaged and no
// live entry triaged `blocker` (T42-D2, D6).
import { isBlocking } from "../../../shared/vocabulary/index.ts";
import { deltaPath } from "./documents.ts";
import { BaseKind, live, partFiles } from "./kind.ts";
import type { ChangeView, Check, GraphEntry, Inputs, ValidateTarget } from "./kind.ts";

const PASSING = ["done", "done-with-concerns"];

function verdictChecks(view: ChangeView, target: ValidateTarget, review = false): Check[] {
  const id = target.id;
  const reports = view.entries.filter(
    (entry) => entry.type === "report" && entry.refs.includes(id),
  );
  const latest = reports.at(-1);
  const status = latest === undefined ? undefined : view.reportStatus(latest);
  const verdict: Check =
    latest === undefined
      ? {
          id: "verdict",
          ok: false,
          why: `no report entry names ${id}`,
          instead: `the verifier records its stored report: bdk log add report "<verdict>" --ref ${id} --ticket <ticket>`,
        }
      : status !== undefined && PASSING.includes(status)
        ? { id: "verdict", ok: true }
        : {
            id: "verdict",
            ok: false,
            why: `the latest report ${latest.id} has status ${status ?? "unreadable"}, not done or done-with-concerns`,
          };
  const blockers = view.entries.filter((entry) => isBlocking(entry, id, { triaged: review }));
  const blocker: Check =
    blockers.length === 0
      ? { id: "blockers", ok: true }
      : {
          id: "blockers",
          ok: false,
          why: `live blocker ${blockers.map((entry) => entry.id).join(", ")} ${
            review ? `names ${id} or is triaged blocker` : `names ${id}`
          }`,
          instead: review
            ? "resolve the blocker (bdk log resolve <id>) or triage it again (bdk log triage <id> <level>)"
            : "resolve the blocker: bdk log resolve <id>",
        };
  return [
    verdict,
    ...(review
      ? [mergeCheck(view, id, latest), roundCheck(view, latest), triagedCheck(view, latest)]
      : []),
    blocker,
    ...(latest === undefined
      ? []
      : [freshCheck(view, id, latest, target.requires ?? []), evidenceCheck(view, latest)]),
  ];
}

const MERGE_GROUP = "merge";
const REVIEW_FIX = "review-fix";
const TRIAGED_TYPES: readonly string[] = ["finding", "blocker", "observation"];

/** The verdict is the merged report of a `review-fix` round, never one reviewer's (D2). */
function mergeCheck(view: ChangeView, id: string, latest: GraphEntry | undefined): Check {
  const instead = `bdk log ingest --ticket <ticket>@merge, then bdk log add report "<verdict>" --ticket <ticket>@merge`;
  if (latest === undefined) {
    return { id: "merge-report", ok: false, why: `no merged report names ${id}`, instead };
  }
  if (latest.group !== MERGE_GROUP || latest.ticket === undefined) {
    const of = latest.group === undefined ? "has no group" : `is of group ${latest.group}`;
    return {
      id: "merge-report",
      ok: false,
      why: `the latest report ${latest.id} naming ${id} ${of}, not the merged report of a round`,
      instead,
    };
  }
  const loop = view.ticketLoop(latest.ticket);
  if (loop !== REVIEW_FIX) {
    return {
      id: "merge-report",
      ok: false,
      why: `the merged report ${latest.id} is under ${latest.ticket}, a ${loop ?? "unknown"} ticket, not a ${REVIEW_FIX} round`,
      instead,
    };
  }
  return { id: "merge-report", ok: true };
}

/** The round of the merged report closed `ok`: an open, failed or not-run round decides nothing. */
function roundCheck(view: ChangeView, latest: GraphEntry | undefined): Check {
  if (latest?.group !== MERGE_GROUP || latest.ticket === undefined)
    return { id: "round-ok", ok: true };
  const outcome = view.ticketOutcome(latest.ticket);
  return outcome === "ok"
    ? { id: "round-ok", ok: true }
    : {
        id: "round-ok",
        ok: false,
        why: `the round ${latest.ticket} of the merged report ${latest.id} ${outcome === undefined ? "is still open" : `closed ${outcome}`}; a review is done after its round closes ok`,
        instead:
          outcome === undefined
            ? `bdk attempt close ${latest.ticket} ok|fail`
            : `bdk attempt open review-fix <change-id>, a new round`,
      };
}

/** Every live finding, blocker and observation of the round carries a triage level (D6). */
function triagedCheck(view: ChangeView, latest: GraphEntry | undefined): Check {
  const ticket = latest?.group === MERGE_GROUP ? latest.ticket : undefined;
  const untriaged = view.entries.filter(
    (entry) =>
      ticket !== undefined &&
      entry.ticket === ticket &&
      TRIAGED_TYPES.includes(entry.type) &&
      live(entry) &&
      entry.level === undefined,
  );
  return untriaged.length === 0
    ? { id: "triaged", ok: true }
    : {
        id: "triaged",
        ok: false,
        why: `${untriaged.map((entry) => entry.id).join(", ")} of ${ticket ?? ""} has no triage level`,
        instead: "bdk log triage <id> blocker|should-fix|nice-to-have|not-a-problem",
      };
}

/** Compared to the second, like a gate's ready time (`kernel-pipeline`, Gate). */
const second = (at: string): string => at.slice(0, 19);

/** No kernel `done` of a required node is newer than the report (D2). */
function freshCheck(
  view: ChangeView,
  id: string,
  report: GraphEntry,
  requires: readonly string[],
): Check {
  const newer = view.entries.filter(
    (entry) =>
      entry.type === "transition" &&
      entry.source === "kernel" &&
      entry.gate === undefined &&
      entry.to !== undefined &&
      requires.includes(entry.to) &&
      second(entry.at) > second(report.at),
  );
  const done = newer.at(-1);
  return done === undefined
    ? { id: "fresh", ok: true }
    : {
        id: "fresh",
        ok: false,
        why: `the latest report ${report.id} is older than ${done.id}, the done entry of ${done.to ?? ""}`,
        instead: `run the verifier of ${id} again: a newer passing report must name it`,
      };
}

/** The `evidence` ids the verdict report lists name manifests, and each `pass` is cited (T4). */
function evidenceCheck(view: ChangeView, report: GraphEntry): Check {
  const manifests = new Map(view.evidence.map((manifest) => [manifest.id, manifest]));
  for (const id of view.reportEvidence(report)) {
    const manifest = manifests.get(id);
    if (manifest === undefined) {
      return {
        id: "evidence",
        ok: false,
        why: `the report lists ${id}, which names no evidence manifest of the Change`,
      };
    }
    if (manifest.verdict === "pass" && !manifest.cited) {
      return {
        id: "evidence",
        ok: false,
        why: `the report lists ${id}, a pass without a citation`,
        rule: "policy/missing-citation",
        instead:
          "bdk evidence record <kind> <file> --ticket <ticket> --verdict pass --cite <pointer>",
      };
    }
  }
  return { id: "evidence", ok: true };
}

export class DesignVerifyKind extends BaseKind {
  readonly name = "design-verify";
  writes(): readonly string[] {
    return [];
  }
  /** Any edit to the design makes the verdict stale. */
  inputs(view: ChangeView): Inputs {
    const documents = ["design.md", "architecture.md"].filter(
      (path) => view.file(path) !== undefined,
    );
    return { files: [...documents, ...partFiles(view, "design/parts").values()] };
  }
  validate(view: ChangeView, target: ValidateTarget): Check[] {
    return verdictChecks(view, target);
  }
}

export class PlanVerifyKind extends BaseKind {
  readonly name = "plan-verify";
  writes(): readonly string[] {
    return [];
  }
  /** P2: a verdict given for other plan parts or spec deltas is stale. */
  inputs(view: ChangeView): Inputs {
    return {
      files: [...partFiles(view, "plan/parts").values(), ...view.specDeltas().map(deltaPath)],
    };
  }
  validate(view: ChangeView, target: ValidateTarget): Check[] {
    return verdictChecks(view, target);
  }
}

export class ReviewKind extends BaseKind {
  readonly name = "review";
  writes(): readonly string[] {
    return [];
  }
  /** The committed code tree, so ledger writes and uncommitted edits do not stale it. */
  inputs(): Inputs {
    return { codeTree: true };
  }
  validate(view: ChangeView, target: ValidateTarget): Check[] {
    return verdictChecks(view, target, true);
  }
}
