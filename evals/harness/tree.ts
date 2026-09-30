// The repository tree a series records (design D-11): a row's `bdkCommit`
// must describe what ran, so a measured series starts only from a committed
// tree. Result rows are the only change allowed.
import { execFileSync } from "node:child_process";

import { REPO_ROOT } from "./paths.ts";

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

function git(repoRoot: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, env: GIT_ENV, encoding: "utf8" }).trim();
}

/** Throws when anything but `evals/results/` differs from HEAD. */
export function assertCommitted(repoRoot = REPO_ROOT): void {
  const dirty = git(repoRoot, "status", "--porcelain", "--", ".", ":!evals/results");
  if (dirty !== "") {
    throw new Error(`commit the working tree before a series; the rows record HEAD:\n${dirty}`);
  }
}

export function headCommit(repoRoot = REPO_ROOT): string {
  return git(repoRoot, "rev-parse", "HEAD");
}
