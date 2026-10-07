// `bdk commit <change-id>` (`kernel-cli/commit`; T22 design D-10, T42): the
// diff check of the Change, then one pathspec commit of the touched paths and
// the Change directory with the BDK trailers, under the open `review-fix`
// ticket. A part agent commits a task itself with the command `bdk check run`
// prints (#166). Files the user staged elsewhere stay staged and out of the
// commit; the user's hooks run.
import { join, relative, sep } from "node:path";

import { commitMessage } from "../domain/report.ts";
import type { CommitReport } from "../domain/report.ts";
import { withChangeIndex } from "../../log/index.ts";
import { diffCheck, tinyGuard } from "../../part/index.ts";
import { changedPaths, gitInProgress, pathspecCommit } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  effectiveProfile,
  findChangeRow,
  isProfile,
  listEntries,
  processLockWait,
  readAttempts,
  readPlanParts,
  TASK_ID,
  taskHolders,
  withLock,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { CommitDeps } from "./deps.ts";

interface CommitInput {
  /** The active Change's id. */
  readonly target: string;
  readonly message?: string | undefined;
}

/**
 * One kernel commit at a time per repository (Serialised commits; T41-D12):
 * two pathspec commits racing for git's index would fail one of them, and the
 * merge back of `part done` takes the same lock.
 */
export async function commitReview(
  deps: CommitDeps,
  change: ActiveChange,
  input: CommitInput,
): Promise<CommitReport | Refusal> {
  if (input.target !== change.id) return notTheChange(deps, change, input.target);
  const path = join(change.projectRoot, ".bdk", ".machine", "commit.lock");
  const result = await withLock(
    deps.store,
    path,
    input.target,
    deps.commitLock ?? processLockWait(),
    () => commitLocked(deps, change, input),
  );
  if (!("busy" in result)) return result;
  const { pid, owner, at } = result.busy;
  return refuse(
    "policy/commit-busy",
    `process ${String(pid)} has held .bdk/.machine/commit.lock for ${owner} since ${at}`,
    [
      `bdk commit ${input.target}${input.message === undefined ? "" : ` --message ${JSON.stringify(input.message)}`}`,
    ],
  );
}

function commitLocked(
  deps: CommitDeps,
  change: ActiveChange,
  input: CommitInput,
): Promise<CommitReport | Refusal> {
  return withChangeIndex(deps, change, (index) =>
    commitReviewFix(deps, change, index, input.message),
  );
}

/** A task id names `check run`, whose printed command commits a task (#166); any other id is unknown. */
function notTheChange(deps: CommitDeps, change: ActiveChange, target: string): Promise<Refusal> {
  if (TASK_ID.test(target)) {
    const part = taskHolders(readPlanParts(deps.store, change.dir)).get(target);
    const ticket = readAttempts(deps.store, change.dir).find(
      ({ data }) => data.outcome === undefined && data.target === part?.id,
    )?.data.ticket;
    return Promise.resolve(
      refuse(
        "input/invalid-argument",
        `a task is committed by its part agent with the git command bdk check run prints, not by bdk commit`,
        [`bdk check run ${target} --ticket ${ticket ?? "<ticket>"}`],
      ),
    );
  }
  return Promise.resolve(
    refuse("input/not-found", `${target} is not the active Change ${change.id}`, [
      `bdk commit ${change.id}`,
    ]),
  );
}

/**
 * A review fix (T42): committed while its `review-fix` ticket is open, since
 * the round reviews the committed fix; every touched path is the Change's.
 */
async function commitReviewFix(
  deps: CommitDeps,
  change: ActiveChange,
  index: IndexDb,
  message: string | undefined,
): Promise<CommitReport | Refusal> {
  const inProgress = gitInProgress(change.projectRoot);
  if (inProgress !== undefined) return inProgress;
  const open = readAttempts(deps.store, change.dir).find(
    ({ data }) =>
      data.outcome === undefined && data.loop === "review-fix" && data.target === change.id,
  );
  if (open === undefined) {
    return refuse("policy/no-open-ticket", `no review-fix ticket of ${change.id} is open`, [
      `bdk attempt open review-fix ${change.id}`,
      "bdk attempt list",
    ]);
  }
  const ticket = open.data.ticket;
  const diff = await diffCheck(deps, change, index, { change: true });
  if ("refused" in diff) return diff;

  const dir = `${relative(change.projectRoot, change.dir).split(sep).join("/")}/`;
  const changed = await changedPaths(deps.git, change.projectRoot, [dir]);
  if (diff.declared.length === 0 && changed.length === 0) {
    return refuse(
      "policy/nothing-to-commit",
      `neither a code path nor ${dir} changed since the last commit`,
      ["bdk attempt list"],
    );
  }
  const trailers = { "BDK-Change": change.id, "BDK-Ticket": ticket };
  const subject = message?.trim() ?? "";
  const committed = await pathspecCommit(
    deps.git,
    change.projectRoot,
    [...diff.declared, dir],
    commitMessage(subject === "" ? `fix(review): ${ticket}` : subject, trailers),
  );
  if (!committed.committed) {
    return refuse(
      "policy/git-hook-failed",
      `a git hook rejected the review fix of ${ticket}: ${committed.output}`,
      [`fix what the hook reports, then run bdk commit ${change.id}`],
    );
  }
  if (tiny(index, change)) await tinyGuard(deps, change, index);
  return {
    ticket,
    commit: committed.commit.slice(0, 7),
    trailers,
    files: [...diff.declared, ...changed],
  };
}

function tiny(index: IndexDb, change: ActiveChange): boolean {
  const row = findChangeRow(index, change.id);
  if (row === undefined || !isProfile(row.profile)) return false;
  return effectiveProfile(row.profile, listEntries(index, change.id)) === "tiny";
}
