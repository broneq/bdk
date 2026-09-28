// The kinds with no file of their own: `gate` (T1: provenance and timing
// only), the post-task steps `simplify`, `tests-scoped` and `lint` (T23-D40)
// and `close` (T30). A step is done through evidence: the latest manifest of
// its kind covering the part, fresh against its own target and saying `pass`
// or `not-run`.
import type { Role } from "../../../shared/vocabulary/index.ts";
import { BaseKind, partFiles } from "./kind.ts";
import type { ChangeView, Check, DoneBy, EvidenceFacts, Inputs, Instance } from "./kind.ts";

abstract class FilelessKind extends BaseKind {
  writes(): readonly string[] {
    return [];
  }
  inputs(): Inputs {
    return { none: true };
  }
  validate(): Check[] {
    return [];
  }
}

export class GateKind extends FilelessKind {
  readonly name = "gate";
  override readonly doneBy: DoneBy = { through: "gate" };
}

const DONE_VERDICTS: readonly (string | undefined)[] = ["pass", "not-run"];

/**
 * Every evidence kind run after a task (`kernel-pipeline`, Artifact kinds):
 * one instance per plan part, the part's tree hash as input, the state from
 * the latest covering manifest. A test registers a kind of its own with it
 * (T23-D51).
 */
export class PostTaskStepKind extends BaseKind {
  override readonly doneBy: DoneBy;

  /** `command` records the kind's evidence; `bdk done` refused names it; `role` runs the step. */
  constructor(
    readonly name: string,
    readonly command: string,
    readonly role: Role,
  ) {
    super();
    this.doneBy = { through: "evidence", command };
  }

  instances(view: ChangeView): readonly Instance[] {
    return [...partFiles(view, "plan/parts").keys()].map((nn) => ({ nn, requires: [] }));
  }

  writes(view: ChangeView, nn?: string): readonly string[] {
    return [`evidence/${nn ?? "<nn>"}-<evidenceId>.md`];
  }

  inputs(view: ChangeView, nn?: string): Inputs {
    const tree = nn === undefined ? undefined : view.partTree(nn);
    return tree === undefined ? { none: true } : { tree };
  }

  /**
   * The latest manifest of the kind covering part `nn`: its target is a task
   * of the part, the part or the Change. Of two manifests with one `at` (one
   * millisecond) the fresh one counts as the later.
   */
  evidence(view: ChangeView, nn: string): EvidenceFacts | undefined {
    const path = partFiles(view, "plan/parts").get(nn);
    const tasks = new Set(
      (path === undefined ? undefined : view.planPart(path))?.tasks.map((task) => task.id),
    );
    let latest: EvidenceFacts | undefined;
    for (const manifest of view.evidence) {
      const covers =
        manifest.target === nn || manifest.target === view.id || tasks.has(manifest.target);
      if (manifest.kind !== this.name || !covers) continue;
      if (latest === undefined || manifest.at > latest.at || manifest.fresh || !latest.fresh) {
        latest = manifest;
      }
    }
    return latest;
  }

  validate(view: ChangeView, target: { readonly nn?: string | undefined }): Check[] {
    const nn = target.nn ?? "";
    const latest = this.evidence(view, nn);
    if (latest === undefined) {
      return [
        {
          id: "evidence",
          ok: false,
          why: `no ${this.name} manifest covers part ${nn}`,
          instead: this.command,
        },
      ];
    }
    return [
      { id: "evidence", ok: true, why: `${latest.id} of ${latest.target}` },
      latest.fresh
        ? { id: "fresh", ok: true }
        : {
            id: "fresh",
            ok: false,
            why: `${latest.id} was recorded on another tree of ${latest.target}`,
            rule: "policy/stale-evidence",
            instead: this.command,
          },
      DONE_VERDICTS.includes(latest.verdict)
        ? { id: "verdict", ok: true, why: latest.verdict ?? "" }
        : {
            id: "verdict",
            ok: false,
            why: `${latest.id} says ${latest.verdict ?? "no verdict"}`,
            instead: this.command,
          },
    ];
  }
}

/** The shipped steps, in pipeline order; `simplify`'s manifest is recorded by `attempt close ok` (T23-D43). */
export function postTaskSteps(): PostTaskStepKind[] {
  return [
    new PostTaskStepKind("simplify", "bdk attempt close <ticket> ok", "simplifier"),
    new PostTaskStepKind(
      "tests-scoped",
      "bdk evidence record tests-scoped <file> --ticket <ticket>",
      "runner",
    ),
    new PostTaskStepKind("lint", "bdk evidence record lint <file> --ticket <ticket>", "runner"),
  ];
}

export class CloseKind extends FilelessKind {
  readonly name = "close";
  override readonly doneBy: DoneBy = { through: "command", command: "bdk change close" };
}
