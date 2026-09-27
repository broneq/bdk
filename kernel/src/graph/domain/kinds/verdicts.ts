// The verdict kinds `plan-verify` and `review` (`kernel-pipeline`, Artifact
// kinds; design D-4): the latest `report` naming the node must pass and no
// live blocker may name it. The report is read, never hashed.
import { BaseKind, live, partFiles } from "./kind.ts";
import type { ChangeView, Check, Inputs } from "./kind.ts";

const PASSING = ["done", "done-with-concerns"];

function verdictChecks(view: ChangeView, id: string): Check[] {
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
          instead: `record the report naming ${id}: bdk log ingest --ticket <ticket>`,
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
  return [verdict, blocker];
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
  validate(view: ChangeView, target: { readonly id: string }): Check[] {
    return verdictChecks(view, target.id);
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
  validate(view: ChangeView, target: { readonly id: string }): Check[] {
    return verdictChecks(view, target.id);
  }
}
