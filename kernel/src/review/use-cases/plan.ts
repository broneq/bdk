// `bdk review plan [--full] [--base <ref>]` (`kernel-cli/review`; T42-R1):
// the range of the next review round and its reviewer groups. Reads committed
// state only - the ledger's `merge` reports, the plan parts, git - and writes
// nothing, so the same repository and ledger give the same plan.
import { moduleValue, resolveOrRefuse } from "../../shared/config/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import { dirtyTracked, headCommit, mergeBase, resolveCommit } from "../../shared/git/index.ts";
import type { Git } from "../../shared/git/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  changeBase,
  EMPTY_TREE,
  listEntries,
  readPlanParts,
  refreshChange,
  withIndex,
} from "../../shared/store/index.ts";
import type { IndexOpener, Store } from "../../shared/store/index.ts";
import { moduleOf, rangeStats } from "../../measure/index.ts";
import type { FileStat } from "../../measure/index.ts";
import { reviewGroupModule } from "../config.ts";
import { reviewGroups } from "../domain/groups.ts";
import type { ReviewPlan } from "../domain/plan.ts";

export interface ReviewDeps {
  readonly store: Store;
  readonly git: Git;
  readonly openIndex: IndexOpener;
  readonly pluginRoot: string;
  readonly settings: ConfigRegistry;
}

export interface PlanInput {
  readonly full: boolean;
  readonly base: string | undefined;
  readonly globalDir: string;
}

const MERGE_GROUP = "merge";

export async function reviewPlan(
  deps: ReviewDeps,
  change: ActiveChange,
  input: PlanInput,
): Promise<ReviewPlan | Refusal> {
  if (input.full && input.base !== undefined) {
    return refuse(
      "input/invalid-argument",
      "--full reviews from the Change base and --base from a merge base; pass one",
      ["bdk review plan --full", `bdk review plan --base ${input.base}`],
    );
  }
  const resolved = resolveOrRefuse(
    {
      store: deps.store,
      settings: deps.settings,
      globalDir: input.globalDir,
      projectRoot: change.projectRoot,
      pluginRoot: deps.pluginRoot,
    },
    { removed: "ignore" },
  );
  if (isRefusal(resolved)) return resolved;
  const root = change.projectRoot;
  // Without a commit there is no history to review: the range is empty.
  const head = (await headCommit(deps.git, root)) ?? EMPTY_TREE;

  const anchor = await anchorOf(deps, change, input);
  if (isRefusal(anchor)) return anchor;
  // One numstat read gives the measure, the group files and the binary list.
  const stats = await rangeStats(deps, root, anchor.sha, head);
  if (isRefusal(stats)) return stats;
  const measured = stats.report;
  const binary = binaryOf(stats.files);
  const parts = readPlanParts(deps.store, change.dir).map((part) => ({
    id: part.id,
    files: part.tasks.flatMap((task) => task.files.map((file) => file.path)),
  }));
  return {
    change: change.id,
    anchor,
    head,
    range: `${anchor.sha}..${head}`,
    dirty: (await dirtyTracked(deps.git, root)).filter((path) => !isBdk(path)),
    measure: {
      files: measured.files,
      added: measured.added,
      removed: measured.removed,
      modules: measured.modules,
    },
    binary,
    groups: reviewGroups({
      changed: stats.files.map((file) => file.path),
      binary,
      parts,
      maxFiles: moduleValue(reviewGroupModule, resolved.value)["max-files"],
      moduleOf,
    }),
  };
}

/**
 * The changed files of `<base>..<head>` git counts as binary, sorted: what
 * `review plan` returns in `binary`, for `dispatch build`, which gets the
 * range and not the plan (#158).
 */
export async function rangeBinary(
  git: Git,
  workTree: string,
  base: string,
  head: string,
): Promise<string[] | Refusal> {
  const stats = await rangeStats({ git }, workTree, base, head);
  if (isRefusal(stats)) return stats;
  return binaryOf(stats.files);
}

/**
 * `--base`: the merge base with `<ref>`; `--full`: the Change base; else the
 * `head` of the latest merged review, the Change base when there is none or
 * when rewritten history no longer holds it.
 */
async function anchorOf(
  deps: ReviewDeps,
  change: ActiveChange,
  input: PlanInput,
): Promise<ReviewPlan["anchor"] | Refusal> {
  const root = change.projectRoot;
  if (input.base !== undefined) {
    const commit = await resolveCommit(deps.git, root, input.base);
    const sha = commit === undefined ? undefined : await mergeBase(deps.git, root, commit);
    if (sha === undefined) {
      return refuse(
        "input/invalid-argument",
        `${input.base} names no commit sharing history with HEAD`,
        ["git branch --list", "bdk review plan --full"],
      );
    }
    return { kind: "base", sha };
  }
  if (!input.full) {
    const head = await withIndex(deps.openIndex, deps.store, root, (index) => {
      refreshChange(index, { id: change.id, dir: change.dir, archived: false });
      return listEntries(index, change.id, { type: "report" })
        .filter((entry) => entry.group === MERGE_GROUP && entry.head !== undefined)
        .at(-1)?.head;
    });
    const sha = head === undefined ? undefined : await resolveCommit(deps.git, root, head);
    if (sha !== undefined) return { kind: "delta", sha };
  }
  return { kind: "full", sha: await changeBase(deps.store, deps.git, root, change.dir) };
}

/** Ledger and machine files are never reviewed: any path with a `.bdk` segment. */
function isBdk(path: string): boolean {
  return path.split("/").includes(".bdk");
}

function binaryOf(files: readonly FileStat[]): string[] {
  return files.filter((file) => file.binary).map((file) => file.path);
}
