// The kinds with no file of their own: `gate` (T1: provenance and timing
// only), the post-task steps `simplify`, `tests-scoped` and `lint` (T23-D40),
// the change-level checks `tests-full` and `lint-full` (T42-D4) and `close`
// (T30). A step or check is done through evidence: the latest manifest of its
// kind covering the part or the Change, fresh against its own target and
// saying `pass` or `not-run`.
import type { Role } from "../../../shared/vocabulary/index.ts";
import { BaseKind, partFiles } from "./kind.ts";
import type {
  ChangeView,
  Check,
  DoneBy,
  EvidenceFacts,
  EvidenceState,
  Inputs,
  Instance,
} from "./kind.ts";

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

  evidenceState(view: ChangeView, nn?: string): EvidenceState {
    return stateOf(nn === undefined ? undefined : this.evidence(view, nn));
  }

  validate(view: ChangeView, target: { readonly nn?: string | undefined }): Check[] {
    const nn = target.nn ?? "";
    return manifestChecks(
      this.evidence(view, nn),
      `no ${this.name} manifest covers part ${nn}`,
      this.command,
    );
  }
}

/** A node's state from its latest manifest: stale before not passing, absent as open. */
function stateOf(latest: EvidenceFacts | undefined, label = "evidence"): EvidenceState {
  if (latest === undefined) return { state: "open" };
  if (!latest.fresh) {
    return {
      state: "stale",
      why: `${label} ${latest.id} of ${latest.target} was recorded on another tree`,
    };
  }
  return DONE_VERDICTS.includes(latest.verdict)
    ? { state: "done" }
    : {
        state: "open",
        why: `${label} ${latest.id} of ${latest.target} says ${latest.verdict ?? "no verdict"}`,
      };
}

/** The `evidence`, `fresh` and `verdict` checks of a latest manifest; one failing `evidence` check without it. */
function manifestChecks(
  latest: EvidenceFacts | undefined,
  missing: string,
  command: string,
): Check[] {
  if (latest === undefined) return [{ id: "evidence", ok: false, why: missing, instead: command }];
  return [
    { id: "evidence", ok: true, why: `${latest.id} of ${latest.target}` },
    latest.fresh
      ? { id: "fresh", ok: true }
      : {
          id: "fresh",
          ok: false,
          why: `${latest.id} was recorded on another tree of ${latest.target}`,
          rule: "policy/stale-evidence",
          instead: command,
        },
    DONE_VERDICTS.includes(latest.verdict)
      ? { id: "verdict", ok: true, why: latest.verdict ?? "" }
      : {
          id: "verdict",
          ok: false,
          why: `${latest.id} says ${latest.verdict ?? "no verdict"}`,
          instead: command,
        },
  ];
}

/** The latest manifest of `kind` the Change is the target of; of two at one `at` the fresh one. */
function latestOfChange(view: ChangeView, kind: string, tool?: string): EvidenceFacts | undefined {
  let latest: EvidenceFacts | undefined;
  for (const manifest of view.evidence) {
    if (manifest.kind !== kind || manifest.target !== view.id) continue;
    if (tool !== undefined && manifest.tool !== tool) continue;
    if (latest === undefined || manifest.at > latest.at || manifest.fresh || !latest.fresh) {
      latest = manifest;
    }
  }
  return latest;
}

const COVERAGE = "coverage";

/**
 * A check of the whole Change run once before review (`kernel-pipeline`,
 * Artifact kinds; T42-D4): one node, the Change's tree hash as input, the
 * state from the latest manifest of the kind targeting the Change. With
 * `coverage`, every `tools.test` entry with `coverage.min` also needs a fresh
 * passing `coverage` manifest (D5).
 */
export class ChangeCheckKind extends BaseKind {
  override readonly doneBy: DoneBy;

  constructor(
    readonly name: string,
    readonly coverage: boolean,
  ) {
    super();
    this.doneBy = {
      through: "evidence",
      command: `bdk evidence record ${name} <file> --ticket <ticket>@<group>`,
    };
  }

  writes(view: ChangeView): readonly string[] {
    return [`evidence/${view.id}-<evidenceId>.md`];
  }

  inputs(view: ChangeView): Inputs {
    const tree = view.changeTree();
    return tree === undefined ? { none: true } : { tree };
  }

  evidenceState(view: ChangeView): EvidenceState {
    const own = stateOf(latestOfChange(view, this.name));
    if (own.state !== "done") return own;
    for (const tool of this.tools(view)) {
      const latest = latestOfChange(view, COVERAGE, tool);
      if (latest === undefined) return { state: "open", why: missingCoverage(tool) };
      const state = stateOf(latest, COVERAGE);
      if (state.state !== "done") {
        return state.state === "stale"
          ? state
          : {
              state: "open",
              why: `coverage ${latest.id} of ${tool} says ${latest.verdict ?? "no verdict"}`,
            };
      }
    }
    return own;
  }

  validate(view: ChangeView): Check[] {
    return [
      ...manifestChecks(
        latestOfChange(view, this.name),
        `no ${this.name} manifest of the Change`,
        this.doneBy.through === "evidence" ? this.doneBy.command : "",
      ),
      ...this.tools(view).map((tool): Check => {
        const latest = latestOfChange(view, COVERAGE, tool);
        const id = `coverage:${tool}`;
        const instead = `bdk evidence coverage ${tool} <report> --ticket <ticket>`;
        if (latest === undefined) return { id, ok: false, why: missingCoverage(tool), instead };
        if (!latest.fresh) {
          return {
            id,
            ok: false,
            why: `${latest.id} was recorded on another tree of ${latest.target}`,
            rule: "policy/stale-evidence",
            instead,
          };
        }
        return latest.verdict === "pass"
          ? { id, ok: true, why: `${latest.id} passes` }
          : { id, ok: false, why: `${latest.id} says ${latest.verdict ?? "no verdict"}`, instead };
      }),
    ];
  }

  private tools(view: ChangeView): readonly string[] {
    return this.coverage ? view.coverageTools : [];
  }
}

function missingCoverage(tool: string): string {
  return `no coverage manifest of ${tool} for the Change`;
}

/** The shipped change-level checks, in pipeline order. */
export function changeChecks(): ChangeCheckKind[] {
  return [new ChangeCheckKind("tests-full", true), new ChangeCheckKind("lint-full", false)];
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
