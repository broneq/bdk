// Task progress from git (`kernel-loops`, Progress from git): a task is
// committed when a commit reachable from `HEAD`, or from its live part branch,
// carries the three BDK trailers; a part merge commit carries two of them,
// `BDK-Change` with the `BDK-Ticket` of a `review-fix` ticket is a review fix
// (T42), and `BDK-Part` with the `BDK-Ticket` of a `part` or `verify-fix`
// ticket of that part is part work, the conformer's fixes (#166); neither
// commits a task. Trailers that disagree with the plan or the attempt records are
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
  /** Ticket -> part of every `part` and `verify-fix` ticket. */
  const partTickets = new Map(
    attempts
      .filter(({ data }) => data.loop === "part" || data.loop === "verify-fix")
      .map(({ data }) => [data.ticket, data.target]),
  );
  const committed = new Map<string, string>();
  const mismatches: string[] = [];
  for (const commit of commits) {
    const short = commit.commit.slice(0, 7);
    if (commit.merge === true && commit.part !== undefined && commit.task === undefined) {
      if (!parts.some((part) => part.id === commit.part)) {
        mismatches.push(
          `merge commit ${short} carries BDK-Part: ${commit.part}, but no plan part is ${commit.part}`,
        );
      }
      continue;
    }
    if (commit.part === undefined && commit.task === undefined && commit.ticket !== undefined) {
      if (!reviewFixes.has(commit.ticket)) {
        mismatches.push(
          `commit ${short} carries BDK-Ticket: ${commit.ticket}, but no review-fix ticket of ${change} is ${commit.ticket}`,
        );
      }
      continue;
    }
    if (commit.part !== undefined && commit.task === undefined && commit.ticket !== undefined) {
      if (partTickets.get(commit.ticket) !== commit.part) {
        mismatches.push(
          `commit ${short} carries BDK-Part: ${commit.part} and BDK-Ticket: ${commit.ticket}, but no part or verify-fix ticket of part ${commit.part} is ${commit.ticket}`,
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
  for (const [ticket, part] of partTickets) {
    if (!parts.some((found) => found.id === part)) {
      mismatches.push(`attempt record ${ticket} targets part ${part}, but no plan part is ${part}`);
    }
  }
  return { commits, committed, mismatches };
}
