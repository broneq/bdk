// The diff check (`kernel-loops`, Diff check; T22 design D-9): the working
// tree against `HEAD`, never the envelope's file list (P6). `attempt close`
// and `commit` run it through `part/index.ts`.
import type { Git } from "../../shared/git/index.ts";
import { workTreePaths } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  firstMatch,
  listEntries,
  matchesGlob,
  onlyKernelIgnores,
  readPlanParts,
  taskHolders,
  taskProgress,
} from "../../shared/store/index.ts";
import type { IndexDb, PlanPartFile, Store } from "../../shared/store/index.ts";
import { startedParts } from "./parts.ts";

/** What the diff is compared with: a task, a part, the whole Change, or a verifier (not checked). */
export type DiffTarget =
  | { readonly task: string }
  | { readonly part: string }
  | { readonly change: true }
  | { readonly verifier: true };

export interface DiffCheck {
  /** Every changed path, `.bdk/` excluded, sorted. */
  readonly touched: readonly string[];
  /** The touched paths the target declares. */
  readonly declared: readonly string[];
  /** The touched paths neither the target nor an uncommitted task of a started part declares. */
  readonly undeclared: readonly string[];
}

export interface DiffFacts {
  readonly parts: readonly PlanPartFile[];
  /** Part ids with a `part start` marker. */
  readonly started: ReadonlySet<string>;
  /** Task ids with a trailer commit. */
  readonly committed: ReadonlySet<string>;
  readonly touched: readonly string[];
}

interface DiffDeps {
  readonly store: Store;
  readonly git: Git;
}

/** Reads the facts, then classifies; a forbidden path is `policy/do-not-touch`. */
export async function diffCheck(
  deps: DiffDeps,
  change: ActiveChange,
  index: IndexDb,
  target: DiffTarget,
): Promise<DiffCheck | Refusal> {
  if ("verifier" in target) return { touched: [], declared: [], undeclared: [] };
  const parts = readPlanParts(deps.store, change.dir);
  const progress = await taskProgress(deps.git, change.projectRoot, change.id, parts, []);
  const changed = (await workTreePaths(deps.git, change.projectRoot)).filter(
    (path) => !path.startsWith(".bdk/"),
  );
  const touched =
    changed.includes(".gitignore") &&
    (await onlyKernelIgnores(deps.store, deps.git, change.projectRoot))
      ? changed.filter((path) => path !== ".gitignore")
      : changed;
  return classifyDiff(target, {
    parts,
    started: startedParts(listEntries(index, change.id, { type: "transition" })),
    committed: new Set(progress.committed.keys()),
    touched,
  });
}

/** The pure rule of D-9 over read facts. */
export function classifyDiff(target: DiffTarget, facts: DiffFacts): DiffCheck | Refusal {
  if ("verifier" in target) return { touched: [], declared: [], undeclared: [] };
  const own = ownSets(target, facts);
  const others = facts.parts
    .filter((part) => facts.started.has(part.id))
    .flatMap((part) => part.tasks)
    .filter((task) => !own.tasks.has(task.id) && !facts.committed.has(task.id))
    .flatMap((task) => task.files.map((file) => file.path));
  const declared: string[] = [];
  const undeclared: string[] = [];
  for (const path of facts.touched) {
    const forbidding = own.forbidden.find((rule) => matchesGlob(rule.glob, path));
    if (forbidding !== undefined) {
      return refuse(
        "policy/do-not-touch",
        `${path} matches do-not-touch ${forbidding.glob} of part ${forbidding.part}`,
        [`git restore --staged --worktree -- ${path}`, `bdk part list`],
      );
    }
    if (firstMatch(own.declared, path) !== undefined) declared.push(path);
    else if (firstMatch(others, path) === undefined) undeclared.push(path);
  }
  return { touched: facts.touched, declared, undeclared };
}

interface OwnSets {
  readonly tasks: ReadonlySet<string>;
  readonly declared: readonly string[];
  readonly forbidden: readonly { readonly part: string; readonly glob: string }[];
}

function ownSets(target: Exclude<DiffTarget, { verifier: true }>, facts: DiffFacts): OwnSets {
  const forbiddenOf = (part: PlanPartFile) =>
    part.data["do-not-touch"].map((glob) => ({ part: part.id, glob }));
  if ("task" in target) {
    const part = taskHolders(facts.parts).get(target.task);
    const task = part?.tasks.find((found) => found.id === target.task);
    return {
      tasks: new Set([target.task]),
      declared: task?.files.map((file) => file.path) ?? [],
      forbidden: part === undefined ? [] : forbiddenOf(part),
    };
  }
  if ("part" in target) {
    const part = facts.parts.find((found) => found.id === target.part);
    return {
      tasks: new Set(part?.tasks.map((task) => task.id) ?? []),
      declared: part?.tasks.flatMap((task) => task.files.map((file) => file.path)) ?? [],
      forbidden: part === undefined ? [] : forbiddenOf(part),
    };
  }
  return {
    tasks: new Set(),
    declared: [],
    forbidden: facts.parts.filter((part) => facts.started.has(part.id)).flatMap(forbiddenOf),
  };
}
