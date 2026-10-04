// The diff check (`kernel-loops`, Diff check; T22 design D-9): the working
// tree against `HEAD`, never the envelope's file list (P6). `attempt close`
// and `commit` run it through `part/index.ts`.
import type { Git } from "../../shared/git/index.ts";
import { differFrom, untrackedFiles, workTreePaths } from "../../shared/git/index.ts";
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
  workRootOf,
} from "../../shared/store/index.ts";
import type { IndexDb, PlanPartFile, Store } from "../../shared/store/index.ts";
import { startedParts } from "./parts.ts";

/**
 * What the diff is compared with: a task, a part, the whole Change (a review
 * fix, which declares every path it touches), or a verifier (not checked).
 */
export type DiffTarget =
  | { readonly task: string }
  | { readonly part: string; readonly merge?: MergeTarget }
  | { readonly change: true }
  | { readonly verifier: true };

/** A merge ticket's merge in the part's worktree (T45 design D6). */
interface MergeTarget {
  /** The ref merged in: the Change branch. */
  readonly ref: string;
  /** The paths unmerged when the ticket opened; they count as declared. */
  readonly conflicts: readonly string[];
}

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
  const root = await workRootOf(
    deps.git,
    deps.store,
    change,
    parts,
    "task" in target ? target.task : "part" in target ? target.part : change.id,
  );
  const changed = (await workTreePaths(deps.git, root)).filter((path) => !path.startsWith(".bdk/"));
  const kept =
    changed.includes(".gitignore") && (await onlyKernelIgnores(deps.store, deps.git, root))
      ? changed.filter((path) => path !== ".gitignore")
      : changed;
  const merge = "part" in target ? target.merge : undefined;
  const touched = merge === undefined ? kept : await notMergedIn(deps.git, root, merge.ref, kept);
  const started = startedParts(listEntries(index, change.id, { type: "transition" }));
  return classifyDiff(target, {
    parts,
    // Only the part itself runs inside its worktree: its other tasks are the only work in flight.
    started: root === change.projectRoot ? started : ownPart(parts, target),
    committed: new Set(progress.committed.keys()),
    touched,
  });
}

/** The part of a task or part target, the one part that works in its worktree. */
function ownPart(parts: readonly PlanPartFile[], target: DiffTarget): ReadonlySet<string> {
  const id =
    "task" in target
      ? taskHolders(parts).get(target.task)?.id
      : "part" in target
        ? target.part
        : undefined;
  return new Set(id === undefined ? [] : [id]);
}

/**
 * The paths a merge ticket's own work changes: a path whose content equals
 * the merged-in ref came with the merge, not from the ticket (T45 design D6).
 */
async function notMergedIn(
  git: Git,
  root: string,
  ref: string,
  paths: readonly string[],
): Promise<string[]> {
  const untracked = new Set(await untrackedFiles(git, root));
  const differing = new Set(await differFrom(git, root, ref, paths));
  return paths.filter((path) => untracked.has(path) || differing.has(path));
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
    // Another started part's work in flight: parallel parts share one tree.
    const elsewhere =
      firstMatch(own.declared, path) === undefined && firstMatch(others, path) !== undefined;
    const forbidding =
      elsewhere || own.conflicts.has(path)
        ? undefined
        : own.forbidden.find((rule) => matchesGlob(rule.glob, path));
    if (forbidding !== undefined) {
      return refuse(
        "policy/do-not-touch",
        `${path} matches do-not-touch ${forbidding.glob} of part ${forbidding.part}`,
        [`git restore --staged --worktree -- ${path}`, `bdk part list`],
      );
    }
    if (firstMatch(own.declared, path) !== undefined) declared.push(path);
    else if (!elsewhere) (own.claimsRest ? declared : undeclared).push(path);
  }
  return { touched: facts.touched, declared, undeclared };
}

interface OwnSets {
  readonly tasks: ReadonlySet<string>;
  readonly declared: readonly string[];
  /** The Change target owns every touched path no other part has in flight. */
  readonly claimsRest: boolean;
  readonly forbidden: readonly { readonly part: string; readonly glob: string }[];
  /** A merge ticket's conflicted paths: declared, never forbidden. */
  readonly conflicts: ReadonlySet<string>;
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
      claimsRest: false,
      forbidden: part === undefined ? [] : forbiddenOf(part),
      conflicts: new Set(),
    };
  }
  if ("part" in target) {
    const part = facts.parts.find((found) => found.id === target.part);
    const conflicts = target.merge?.conflicts ?? [];
    return {
      tasks: new Set(part?.tasks.map((task) => task.id) ?? []),
      declared: [
        ...(part?.tasks.flatMap((task) => task.files.map((file) => file.path)) ?? []),
        ...conflicts,
      ],
      claimsRest: false,
      forbidden: part === undefined ? [] : forbiddenOf(part),
      conflicts: new Set(conflicts),
    };
  }
  return {
    tasks: new Set(),
    declared: [],
    claimsRest: true,
    forbidden: facts.parts.filter((part) => facts.started.has(part.id)).flatMap(forbiddenOf),
    conflicts: new Set(),
  };
}
