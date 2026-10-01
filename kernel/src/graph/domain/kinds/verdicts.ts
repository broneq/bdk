// The verdict kinds `design-verify`, `plan-verify` and `review`
// (`kernel-pipeline`, Artifact kinds; design D-4): the latest `report` naming
// the node must pass, be no older than the `done` of what it verifies
// (v3-t41-design D2), and no live blocker may name it. The report is read,
// never hashed.
import { BaseKind, live, partFiles } from "./kind.ts";
import type { ChangeView, Check, GraphEntry, Inputs, ValidateTarget } from "./kind.ts";

const PASSING = ["done", "done-with-concerns"];

function verdictChecks(view: ChangeView, target: ValidateTarget): Check[] {
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
  const blockers = view.entries.filter(
    (entry) => entry.type === "blocker" && live(entry) && entry.refs.includes(id),
  );
  const blocker: Check =
    blockers.length === 0
      ? { id: "blockers", ok: true }
      : {
          id: "blockers",
          ok: false,
          why: `live blocker ${blockers.map((entry) => entry.id).join(", ")} names ${id}`,
          instead: "resolve the blocker: bdk log resolve <id>",
        };
  return [
    verdict,
    blocker,
    ...(latest === undefined
      ? []
      : [freshCheck(view, id, latest, target.requires ?? []), evidenceCheck(view, latest)]),
  ];
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
  /** P2: a verdict given for other plan parts is stale. */
  inputs(view: ChangeView): Inputs {
    return { files: [...partFiles(view, "plan/parts").values()] };
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
    return verdictChecks(view, target);
  }
}
