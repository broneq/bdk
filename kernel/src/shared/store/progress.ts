// Task progress from git (`kernel-loops`, Progress from git): a task is
// committed when a commit reachable from `HEAD` carries the three BDK
// trailers; `BDK-Change` with the `BDK-Ticket` of a `review-fix` ticket is a
// review fix and commits no task (T42). Trailers that disagree with the plan or the attempt records are
// reported naming both sides, never repaired.
import type { Git, TrailerCommit } from "../git/index.ts";
import { trailerCommits } from "../git/index.ts";
import type { AttemptFile, PlanPartFile } from "./work.ts";
import { taskHolders } from "./work.ts";

export interface TaskProgress {
  /** The Change's trailer commits, newest first. */
  readonly commits: readonly TrailerCommit[];
  /** Task id -> the newest commit carrying it, for tasks the plan holds. */
  readonly committed: ReadonlyMap<string, string>;
  /** One sentence per `state/trailer-mismatch`, naming both sides. */
  readonly mismatches: readonly string[];
}

export async function taskProgress(
  git: Git,
  workTree: string,
  change: string,
  parts: readonly PlanPartFile[],
  attempts: readonly AttemptFile[],
): Promise<TaskProgress> {
  const commits = await trailerCommits(git, workTree, change);
  const holders = taskHolders(parts);
  const reviewFixes = new Set(
    attempts.filter(({ data }) => data.loop === "review-fix").map(({ data }) => data.ticket),
  );
  const committed = new Map<string, string>();
  const mismatches: string[] = [];
  for (const commit of commits) {
    const short = commit.commit.slice(0, 7);
    if (commit.part === undefined && commit.task === undefined && commit.ticket !== undefined) {
      if (!reviewFixes.has(commit.ticket)) {
        mismatches.push(
          `commit ${short} carries BDK-Ticket: ${commit.ticket}, but no review-fix ticket of ${change} is ${commit.ticket}`,
        );
      }
      continue;
    }
    if (commit.part === undefined || commit.task === undefined) {
      const missing = [
        commit.part === undefined ? "BDK-Part" : "",
        commit.task === undefined ? "BDK-Task" : "",
      ]
        .filter((name) => name !== "")
        .join(" and ");
      mismatches.push(`commit ${short} carries BDK-Change: ${change} without ${missing}`);
      continue;
    }
    const holder = holders.get(commit.task);
    if (holder === undefined) {
      mismatches.push(
        `commit ${short} carries BDK-Task: ${commit.task}, but no plan part holds ${commit.task}`,
      );
      continue;
    }
    if (holder.id !== commit.part) {
      mismatches.push(
        `commit ${short} carries BDK-Part: ${commit.part} for BDK-Task: ${commit.task}, but ${holder.file} holds ${commit.task}`,
      );
      continue;
    }
    if (!committed.has(commit.task)) committed.set(commit.task, commit.commit);
  }
  for (const { data } of attempts) {
    if (data.loop === "task-redispatch" && !holders.has(data.target)) {
      mismatches.push(
        `attempt record ${data.ticket} targets task ${data.target}, but no plan part holds ${data.target}`,
      );
    }
  }
  return { commits, committed, mismatches };
}
