// The shell boundary (spec `bdk-cli/check`; design D4 of v3-183-check-run): runs one command
// line through `/bin/sh -c` with stdin at end of file and both output streams in one file, and
// kills the command's whole process group at the timeout, so test runner workers die with it.

import { spawn } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync } from "node:fs";
import { constants } from "node:os";
import { dirname } from "node:path";

export interface ShellOptions {
  /** Where the command runs. */
  readonly cwd: string;
  /** The file that gets stdout and stderr in arrival order; replaced, parents created. */
  readonly output: string;
  /** Seconds before the process group is killed. */
  readonly timeout: number;
}

export type ShellOutcome =
  { readonly kind: "exit"; readonly code: number } | { readonly kind: "timeout" };

export type Shell = (command: string, options: ShellOptions) => Promise<ShellOutcome>;

/** Signals that end the CLI; the running group is killed first, so no check outlives it. */
const ENDING = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

/** The exit code of a shell that cannot start, as the shell gives for a missing command. */
export const CANNOT_START = 127;

/**
 * Runs `command`; `sh` is replaced only in tests. A signal exit counts as 128 plus its number.
 * Whatever the command left running in its process group is killed when the shell exits, at
 * the timeout, and when the CLI itself is interrupted, so nothing writes to the output later.
 */
export function shell(
  command: string,
  options: ShellOptions,
  sh = "/bin/sh",
): Promise<ShellOutcome> {
  mkdirSync(dirname(options.output), { recursive: true });
  const fd = openSync(options.output, "w");
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      // `detached` gives the shell its own process group, which is killed as a whole.
      child = spawn(sh, ["-c", command], {
        cwd: options.cwd,
        stdio: ["ignore", fd, fd],
        detached: true,
      });
    } finally {
      closeSync(fd);
    }
    const killGroup = (): void => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // The group is already gone.
      }
    };
    const interrupted = (signal: NodeJS.Signals): void => {
      killGroup();
      done();
      process.kill(process.pid, signal);
    };
    const done = (): void => {
      clearTimeout(timer);
      for (const signal of ENDING) process.off(signal, interrupted);
    };
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, options.timeout * 1000);
    for (const signal of ENDING) process.on(signal, interrupted);
    child.on("error", (error) => {
      done();
      if ((error as { code?: unknown }).code === "ENOENT") {
        appendFileSync(options.output, `bdk: cannot start ${sh} in ${options.cwd}\n`);
        resolve({ kind: "exit", code: CANNOT_START });
        return;
      }
      reject(error);
    });
    child.on("exit", (code, signal) => {
      done();
      killGroup();
      if (timedOut) {
        resolve({ kind: "timeout" });
        return;
      }
      resolve({
        kind: "exit",
        code: code ?? 128 + (signal === null ? 0 : constants.signals[signal]),
      });
    });
  });
}
