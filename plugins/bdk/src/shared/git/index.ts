// The git boundary (spec `bdk-cli`, "OS boundary"; design D7 of v3-186-git-groups-scope): runs
// the user's git without a shell and returns its stdout. Paths stay byte-exact through
// `core.quotepath=off`; callers that parse paths also pass `-z`.

import { execFileSync } from "node:child_process";

import { CliError } from "../cli/index.ts";

/** git ran and exited non-zero; `stderr` holds its message. */
export class GitError extends Error {
  readonly status: number;
  readonly stderr: string;

  constructor(args: readonly string[], status: number, stderr: string) {
    super(`git ${args.join(" ")} exited ${status}: ${stderr.trim()}`);
    this.name = "GitError";
    this.status = status;
    this.stderr = stderr;
  }
}

/** Runs `git <args>` in `cwd` and returns stdout; `executable` is replaced only in tests. */
export function git(cwd: string, args: readonly string[], executable = "git"): string {
  try {
    return execFileSync(executable, ["-c", "core.quotepath=off", ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (error) {
    const failure = error as { code?: unknown; status?: unknown; stderr?: unknown };
    if (failure.code === "ENOENT") {
      throw new CliError(
        "env/git-missing",
        "git is not on PATH",
        "install git, or add it to PATH, and run the command again",
      );
    }
    if (typeof failure.status === "number") {
      throw new GitError(
        args,
        failure.status,
        typeof failure.stderr === "string" ? failure.stderr : "",
      );
    }
    throw error;
  }
}
