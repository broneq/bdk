// `bdk commit <task|change-id>` (`kernel-cli/commit`; T22 design D-10): the
// diff check of the task, then one pathspec commit of the task's touched paths
// and the Change directory with the BDK trailers. With the Change's id it
// commits a review fix under the open `review-fix` ticket (T42). Files the
// user staged elsewhere stay staged and out of the commit; the user's hooks run.
import { join, relative, sep } from "node:path";

import { commitMessage } from "../domain/report.ts";
import type { CommitReport, ReviewFixReport, TaskCommitReport } from "../domain/report.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
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
  taskHolders,
  withLock,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import type { CommitDeps } from "./deps.ts";

const SUMMARY_MAX = 120;

interface CommitInput {
  /** A task id, or the active Change's id for a review fix. */
  readonly target: string;
  readonly message?: string | undefined;
}

/**
 * One kernel commit at a time per repository (Serialised commits; T41-D12):
 * leads of one wave commit their tasks at once, and two pathspec commits
 * racing for git's index would fail one of them.
 */
export async function commitTask(
  deps: CommitDeps,
  change: ActiveChange,
  input: CommitInput,
): Promise<CommitReport | Refusal> {
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
  return withChangeIndex(deps, change, (index): Promise<CommitReport | Refusal> =>
    input.target === change.id
      ? commitReviewFix(deps, change, index, input.message)
      : commitOneTask(deps, change, index, { task: input.target, message: input.message }),
  );
}

async function commitOneTask(
  deps: CommitDeps,
  change: ActiveChange,
  index: IndexDb,
  input: { readonly task: string; readonly message?: string | undefined },
): Promise<TaskCommitReport | Refusal> {
  const holders = taskHolders(readPlanParts(deps.store, change.dir));
  const part = holders.get(input.task);
  const task = part?.tasks.find((found) => found.id === input.task);
  if (part === undefined || task === undefined) {
    return refuse("input/not-found", `no plan part holds task ${input.task}`, [
      "bdk part list",
      `bdk commit ${change.id} for a review fix`,
    ]);
  }
  const inProgress = gitInProgress(change.projectRoot);
  if (inProgress !== undefined) return inProgress;
  const open = readAttempts(deps.store, change.dir).find(
    (record) => record.data.outcome === undefined && record.data.target === input.task,
  );
  if (open !== undefined) {
    return refuse(
      "policy/ticket-open",
      `ticket ${open.data.ticket} of ${input.task} is still open`,
      [`bdk attempt close ${open.data.ticket} ok|fail|not-run`],
    );
  }
  const diff = await diffCheck(deps, change, index, { task: input.task });
  if ("refused" in diff) return diff;

  const dir = `${relative(change.projectRoot, change.dir).split(sep).join("/")}/`;
  const code = [...diff.declared, ...diff.undeclared];
  if (code.length === 0 && (await changedPaths(deps.git, change.projectRoot, [dir])).length === 0) {
    return refuse(
      "policy/nothing-to-commit",
      `neither a path of ${input.task} nor ${dir} changed since the last commit`,
      ["bdk part list"],
    );
  }
  const finding =
    diff.undeclared.length === 0
      ? undefined
      : await recordUndeclared(deps, change, index, input.task, diff.undeclared);
  if (finding !== undefined && "refused" in finding) return finding;

  const files = [...code, ...(await changedPaths(deps.git, change.projectRoot, [dir]))];
  const trailers = { "BDK-Change": change.id, "BDK-Part": part.id, "BDK-Task": input.task };
  const message = input.message?.trim() ?? "";
  const subject = message === "" ? task.title : message;
  const committed = await pathspecCommit(
    deps.git,
    change.projectRoot,
    [...code, dir],
    commitMessage(subject, trailers),
  );
  if (!committed.committed) {
    return refuse(
      "policy/git-hook-failed",
      `a git hook rejected the commit of ${input.task}: ${committed.output}`,
      [`fix what the hook reports, then run bdk commit ${input.task}`],
    );
  }
  if (tiny(index, change)) await tinyGuard(deps, change, index);
  return {
    task: input.task,
    commit: committed.commit.slice(0, 7),
    trailers,
    files,
    ...(diff.undeclared.length === 0 ? {} : { undeclared: diff.undeclared }),
    ...(finding === undefined ? {} : { finding: finding.id }),
  };
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
): Promise<ReviewFixReport | Refusal> {
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

async function recordUndeclared(
  deps: CommitDeps,
  change: ActiveChange,
  index: IndexDb,
  task: string,
  paths: readonly string[],
): Promise<{ readonly id: string } | Refusal> {
  const count = paths.length;
  const summary = `${task} changed ${String(count)} file${count === 1 ? "" : "s"} its plan does not declare`;
  const written = await appendEntry(
    deps,
    change,
    index,
    {
      type: "finding",
      summary: summary.slice(0, SUMMARY_MAX),
      status: "proposed",
      refs: [task, ...paths],
      body: `${paths.map((path) => `- ${path}`).join("\n")}\n`,
    },
    { dedupe: true },
  );
  return "refused" in written ? written : { id: written.entry.id };
}
