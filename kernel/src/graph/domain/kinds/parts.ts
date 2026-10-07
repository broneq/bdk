// The kinds of parts: `design-part`, `design-index`, `plan-part` and
// `execute-part` (`kernel-pipeline`, Artifact kinds; design D-7). A
// collection node of an instanced kind has one instance per part file.
import { deltaPath } from "./documents.ts";
import { BaseKind, fileChecks, partFiles } from "./kind.ts";
import type { ChangeView, Check, DoneBy, Inputs, Instance, PlanPartFacts } from "./kind.ts";

/** S1: a plan part fits one dispatch (`kernel-loops`, Plan part checks). */
const PART_LIMIT_BYTES = 8192;

/** A kind with one instance per `<dir>/<nn>-<slug>.md`. */
abstract class PartKind extends BaseKind {
  protected abstract readonly dir: string;
  instances(view: ChangeView): readonly Instance[] {
    return [...partFiles(view, this.dir).keys()].map((nn) => ({ nn, requires: [] }));
  }
  writes(view: ChangeView, nn?: string): readonly string[] {
    const path = nn === undefined ? undefined : partFiles(view, this.dir).get(nn);
    return [path ?? `${this.dir}/${nn ?? "<nn>"}-<slug>.md`];
  }
  inputs(view: ChangeView, nn?: string): Inputs {
    const path = nn === undefined ? undefined : partFiles(view, this.dir).get(nn);
    return { files: path === undefined ? [] : [path] };
  }
  validate(view: ChangeView, target: { readonly nn?: string | undefined }): Check[] {
    const path = target.nn === undefined ? undefined : partFiles(view, this.dir).get(target.nn);
    if (path === undefined) {
      return [{ id: "exists", ok: false, why: `${this.dir}/ holds no part ${target.nn ?? ""}` }];
    }
    return fileChecks(view, path);
  }
}

export class DesignPartKind extends PartKind {
  readonly name = "design-part";
  protected readonly dir = "design/parts";
}

/** The baseline checks, then the plan part checks of `kernel-loops` (S1, P6, P7). */
export class PlanPartKind extends PartKind {
  readonly name = "plan-part";
  protected readonly dir = "plan/parts";
  override validate(view: ChangeView, target: { readonly nn?: string | undefined }): Check[] {
    const checks = super.validate(view, target);
    const nn = target.nn ?? "";
    const path = partFiles(view, this.dir).get(nn);
    const file = path === undefined ? undefined : view.file(path);
    if (path === undefined || file === undefined) return checks;
    checks.push(
      file.bytes > PART_LIMIT_BYTES
        ? {
            id: "size",
            ok: false,
            why: `${path} is ${String(file.bytes)} bytes, over the limit of ${String(PART_LIMIT_BYTES)}`,
            rule: "policy/part-too-large",
            instead: `bdk part split ${nn} <task-ids>`,
          }
        : { id: "size", ok: true },
    );
    const facts = view.planPart(path);
    if (file.data === undefined || facts === undefined) return checks;
    return [...checks, ...partChecks(view, path, nn, file.data, facts)];
  }
}

function partChecks(
  view: ChangeView,
  path: string,
  nn: string,
  data: Readonly<Record<string, unknown>>,
  facts: PlanPartFacts,
): Check[] {
  const count = facts.tasks.length;
  const { maxTasks, maxFiles } = view.partLimits;
  const files = new Set(facts.tasks.flatMap((task) => task.files)).size;
  const overlap = facts.overlaps[0];
  const impact = specImpactCheck(view, path, data["spec-impact"]);
  return [
    count === 0 || count > maxTasks
      ? {
          id: "tasks",
          ok: false,
          why:
            count === 0
              ? `${path} holds no task`
              : `${path} holds ${String(count)} tasks, over plan.part.max-tasks ${String(maxTasks)}`,
          rule: "policy/part-too-many-tasks",
          instead:
            count === 0 ? `add a task under ## ${nn}-1 <title>` : `bdk part split ${nn} <task-ids>`,
        }
      : { id: "tasks", ok: true },
    // One agent holds the whole part in its context (#166).
    files > maxFiles
      ? {
          id: "files",
          ok: false,
          why: `the tasks of ${path} declare ${String(files)} distinct Files: paths, over plan.part.max-files ${String(maxFiles)}`,
          rule: "policy/part-too-many-files",
          instead: `bdk part split ${nn} <task-ids>`,
        }
      : { id: "files", ok: true },
    overlap === undefined
      ? { id: "do-not-touch", ok: true }
      : {
          id: "do-not-touch",
          ok: false,
          why: facts.overlaps
            .map(
              (found) =>
                `task ${found.task} declares ${found.path}, which do-not-touch ${found.glob} forbids`,
            )
            .join("; "),
          rule: "policy/do-not-touch-overlap",
          instead: `drop ${overlap.path} from task ${overlap.task} or narrow do-not-touch`,
        },
    facts.placeholders.length === 0
      ? { id: "placeholder", ok: true }
      : {
          id: "placeholder",
          ok: false,
          why: `a placeholder holds ${facts.placeholders.join(", ")}`,
          rule: "policy/placeholder",
        },
    facts.problems.length === 0
      ? { id: "grammar", ok: true }
      : { id: "grammar", ok: false, why: facts.problems.join("; ") },
    impact,
    isolationCheck(path, data),
  ];
}

/** A worktree part names the shared state outside `Files:` it isolates (T45). */
function isolationCheck(path: string, data: Readonly<Record<string, unknown>>): Check {
  const reason = data["isolation-reason"];
  if (data.isolation !== "worktree" || (typeof reason === "string" && reason.trim() !== "")) {
    return { id: "isolation", ok: true };
  }
  return {
    id: "isolation",
    ok: false,
    why: "isolation: worktree needs an isolation-reason naming the state outside Files: the part shares",
    instead: `add isolation-reason to the frontmatter of ${path}`,
  };
}

/**
 * Every capability `spec-impact` names has a delta that passes `spec delta
 * check`; absent is `none` except in a `large` Change (T30-D10).
 */
function specImpactCheck(view: ChangeView, path: string, impact: unknown): Check {
  if (impact === undefined && view.profile === "large") {
    return {
      id: "spec-impact",
      ok: false,
      why: "a large Change must declare spec-impact: none or the capabilities the part changes",
      instead: `add spec-impact to the frontmatter of ${path}`,
    };
  }
  for (const capability of Array.isArray(impact) ? impact.map(String) : []) {
    const problems = view.specProblems(capability);
    if (view.file(deltaPath(capability)) === undefined || problems === undefined) {
      return {
        id: "spec-impact",
        ok: false,
        why: `spec-impact names ${capability}, but ${deltaPath(capability)} is missing`,
      };
    }
    if (problems.length > 0) {
      return {
        id: "spec-impact",
        ok: false,
        why: `spec-impact names ${capability}, whose delta fails spec delta check: ${problems.join("; ")}`,
        instead: `bdk spec delta check ${capability}`,
      };
    }
  }
  return { id: "spec-impact", ok: true };
}

export class DesignIndexKind extends BaseKind {
  readonly name = "design-index";
  writes(): readonly string[] {
    return ["design/index.md"];
  }
  inputs(view: ChangeView): Inputs {
    return { files: [...partFiles(view, "design/parts").values()] };
  }
  validate(view: ChangeView): Check[] {
    const parts = [...partFiles(view, "design/parts").values()];
    if (parts.length === 0) {
      return [{ id: "parts", ok: false, why: "design/parts/ holds no design part" }];
    }
    return [
      { id: "parts", ok: true },
      ...parts.flatMap((path) =>
        fileChecks(view, path).map((check) => ({ ...check, id: `${check.id}:${path}` })),
      ),
    ];
  }
}

/**
 * One instance per plan part, following its `depends-on`; done through
 * `part done`, which hashes the plan part file (T22 design D-8).
 */
export class ExecutePartKind extends BaseKind {
  readonly name = "execute-part";
  override readonly doneBy: DoneBy = { through: "command", command: "bdk part done {nn}" };
  instances(view: ChangeView): readonly Instance[] {
    return [...partFiles(view, "plan/parts")].map(([nn, path]) => {
      const dependsOn = view.file(path)?.data?.["depends-on"];
      const requires = Array.isArray(dependsOn)
        ? dependsOn.map((dependency) => `execute-part:${String(dependency)}`)
        : [];
      return { nn, requires };
    });
  }
  writes(): readonly string[] {
    return [];
  }
  inputs(view: ChangeView, nn?: string): Inputs {
    const path = nn === undefined ? undefined : partFiles(view, "plan/parts").get(nn);
    return { files: path === undefined ? [] : [path] };
  }
  /** Started, every task committed with the part's trailers, no ticket of the part open. */
  validate(
    view: ChangeView,
    target: { readonly id: string; readonly nn?: string | undefined },
  ): Check[] {
    const nn = target.nn ?? "";
    const started = view.entries.some(
      (entry) => entry.type === "transition" && entry.source === "kernel" && entry.to === target.id,
    );
    const checks: Check[] = [
      started
        ? { id: "started", ok: true }
        : {
            id: "started",
            ok: false,
            why: `${target.id} is not started`,
            instead: `bdk part start ${nn}`,
          },
    ];
    const { work } = view;
    if (work === undefined) {
      return [
        ...checks,
        { id: "work", ok: false, why: "the trailer commits and open tickets were not read" },
      ];
    }
    const path = partFiles(view, "plan/parts").get(nn);
    const tasks = (path === undefined ? undefined : view.planPart(path))?.tasks ?? [];
    const uncommitted = tasks.find(
      (task) => !work.commits.some((commit) => commit.part === nn && commit.task === task.id),
    );
    checks.push(
      uncommitted === undefined
        ? { id: "commits", ok: true }
        : {
            id: "commits",
            ok: false,
            why: `task ${uncommitted.id} has no commit carrying BDK-Part: ${nn} and BDK-Task: ${uncommitted.id}`,
            instead: `bdk commit ${uncommitted.id}`,
          },
    );
    const own = new Set([nn, ...tasks.map((task) => task.id)]);
    const open = work.openTickets.find((ticket) => own.has(ticket.target));
    checks.push(
      open === undefined
        ? { id: "tickets", ok: true }
        : {
            id: "tickets",
            ok: false,
            why: `ticket ${open.ticket} is open on ${open.target}`,
            instead: `bdk attempt close ${open.ticket} <outcome>`,
          },
    );
    return checks;
  }
}
