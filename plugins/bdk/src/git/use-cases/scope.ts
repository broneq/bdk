// `bdk git scope`: the range a review round covers (spec `bdk-cli/git`, "Scope of a review
// round", "Round record"; design D2-D4).

import { resolve } from "node:path";

import { CliError } from "../../shared/cli/index.ts";
import { GitError } from "../../shared/git/index.ts";
import { nulPaths, numstat, recordHead } from "../domain/range.ts";
import type { ScopeResult } from "../schema/scope.ts";
import { lastFinishedRound } from "../store/rounds.ts";
import type { GitDeps } from "./deps.ts";

export interface ScopeInput {
  readonly base: string;
  /** The run's `review/` directory holding `round-<N>/`; absent for a first or full round. */
  readonly rounds?: string | undefined;
}

/** Options every diff gets, so user settings cannot change paths or detect renames. */
const DIFF = ["--no-ext-diff", "--no-relative", "--no-renames", "-z"];

export function scope(deps: GitDeps, input: ScopeInput): ScopeResult {
  const run = (args: readonly string[]): string => deps.git(deps.cwd, args);
  /** stdout, or the exit status when git failed. */
  const attempt = (args: readonly string[]): string | number => {
    try {
      return run(args);
    } catch (error) {
      if (error instanceof GitError) return error.status;
      throw error;
    }
  };

  if (attempt(["rev-parse", "--is-inside-work-tree"]) !== "true\n") {
    throw new CliError(
      "env/not-a-repo",
      `${deps.cwd} is not inside a git work tree`,
      "run the command in the repository whose branch is reviewed",
    );
  }
  const head = attempt(["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]);
  if (typeof head !== "string") {
    throw new CliError("env/no-head", "HEAD names no commit", "commit the work to review first");
  }
  const headSha = head.trim();
  const baseSha = input.base.startsWith("-")
    ? 1
    : attempt(["rev-parse", "--verify", "--quiet", `${input.base}^{commit}`]);
  if (typeof baseSha !== "string") {
    throw new CliError(
      "usage/invalid-argument",
      `base ${input.base} names no commit`,
      "pass the branch the work merges into, such as main or the pull request base",
    );
  }
  const mergeBase = attempt(["merge-base", headSha, baseSha.trim()]);
  if (typeof mergeBase !== "string") {
    throw new CliError(
      "usage/invalid-argument",
      `HEAD and ${input.base} have no merge base`,
      "pass a base that shares history with HEAD",
    );
  }

  let anchor: ScopeResult["anchor"] = { kind: "base", sha: mergeBase.trim() };
  if (input.rounds !== undefined) {
    const last = lastFinishedRound(deps.files, resolve(deps.cwd, input.rounds));
    if (last !== undefined) {
      const recorded = recordHead(last.record ?? "");
      const ancestor =
        recorded === undefined
          ? undefined
          : attempt(["merge-base", "--is-ancestor", recorded, headSha]);
      if (recorded !== undefined && typeof ancestor === "string") {
        anchor = { kind: "round", sha: recorded, round: last.round };
      } else {
        const why =
          recorded === undefined
            ? "has no groups.json with a valid head"
            : ancestor === 1
              ? `recorded ${recorded.slice(0, 7)}, which is not an ancestor of HEAD`
              : `recorded ${recorded.slice(0, 7)}, which names no commit`;
        anchor = {
          ...anchor,
          fallback: `round ${last.round} ${why}; reviewing from the merge base`,
        };
      }
    }
  }

  const changed = numstat(run(["diff", "--numstat", ...DIFF, anchor.sha, headSha]));
  const deleted = nulPaths(
    run(["diff", "--name-only", "--diff-filter=D", ...DIFF, anchor.sha, headSha]),
  );
  const gone = new Set(deleted);
  const dirty = nulPaths(
    run(["diff", "--name-only", ...DIFF, "HEAD"]) +
      run(["diff", "--cached", "--name-only", ...DIFF]),
  );
  return {
    base: input.base,
    anchor,
    head: headSha,
    range: `${anchor.sha}..${headSha}`,
    files: changed.text.filter((path) => !gone.has(path)),
    binary: changed.binary.filter((path) => !gone.has(path)),
    deleted,
    dirty,
  };
}
