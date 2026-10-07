// A project command run by the kernel (`kernel-cli/check`, step 3; T45 setup):
// through the shell in a working directory, stdin closed so a command that
// reads it ends at once (#166), stdout and stderr captured together, and a
// command still running at the bound killed with its process group.
import { spawn } from "node:child_process";

export interface CommandRun {
  /** Undefined when the command was killed at the bound. */
  readonly exitCode: number | undefined;
  readonly timedOut: boolean;
  readonly durationMs: number;
  /** Stdout and stderr in the order they arrived; its start dropped past `OUTPUT_LIMIT`. */
  readonly output: string;
}

/** The output kept of one command; a longer one keeps its end, where a failure shows. */
const OUTPUT_LIMIT = 4 * 1024 * 1024;

/** The exit code of a command the shell could not start, as the shell reports one it cannot find. */
const NOT_FOUND = 127;

/** The port `check run` runs a project command through; `main.ts` binds `runCommand`. */
export type Shell = (command: string, cwd: string, timeoutMs: number) => Promise<CommandRun>;

export function runCommand(command: string, cwd: string, timeoutMs: number): Promise<CommandRun> {
  const started = performance.now();
  return new Promise((done) => {
    const child = spawn("/bin/sh", ["-c", command], {
      cwd,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const keep = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.length > OUTPUT_LIMIT) output = output.slice(-OUTPUT_LIMIT);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid !== undefined && process.platform !== "win32") {
          process.kill(-child.pid, "SIGKILL");
        } else child.kill("SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMs);
    let finished = false;
    const finish = (code: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      done({
        exitCode: timedOut || code === null ? undefined : code,
        timedOut,
        durationMs: Math.round(performance.now() - started),
        output,
      });
    };
    child.on("error", (error) => {
      output += `${error.message}\n`;
      finish(NOT_FOUND);
    });
    child.on("close", finish);
  });
}

/** The last `count` non-blank lines of an output. */
export function tailLines(output: string, count: number): string[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(-count);
}
