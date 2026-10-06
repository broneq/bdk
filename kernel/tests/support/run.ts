// Runs the built bundle the way a caller does: `node dist/bdk.mjs <args>`
// in a working directory, on the same Node as the test harness.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const BUNDLE = join(REPO_ROOT, "dist", "bdk.mjs");

/**
 * The `PATH` directory that holds git, for a case that runs the bundle with
 * only git on `PATH`, as a command that reads the work tree needs. It must not
 * hold `lavish-axi`, which would leak the machine's install into the case.
 */
export function gitDir(): string {
  const found = (process.env.PATH ?? "")
    .split(delimiter)
    .find((dir) => dir !== "" && existsSync(join(dir, "git")));
  if (found === undefined) throw new Error("the e2e tests need git on PATH");
  if (existsSync(join(found, "lavish-axi"))) {
    throw new Error(`${found} holds git and lavish-axi; the e2e tests need them apart`);
  }
  return found;
}

export interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  /** stdout parsed as JSON, or undefined when it is not one JSON value. */
  readonly json: unknown;
}

export interface RunOptions {
  readonly stdin?: string;
  /** Replaces the inherited environment; CLAUDE_PLUGIN_ROOT is always set. */
  readonly env?: Readonly<Record<string, string>>;
}

export function runBdk(args: readonly string[], cwd: string, options: RunOptions = {}): RunResult {
  const result = spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...(options.env ?? process.env), CLAUDE_PLUGIN_ROOT: REPO_ROOT },
    input: options.stdin ?? "",
  });
  if (result.error !== undefined) throw result.error;
  return {
    code: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
    json: parseJson(result.stdout),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
