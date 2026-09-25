// Runs the committed bundle the way a caller does: `node dist/bdk.mjs <args>`
// in a working directory, on the same Node as the test harness.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const BUNDLE = join(REPO_ROOT, "dist", "bdk.mjs");

export interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  /** stdout parsed as JSON, or undefined when it is not one JSON value. */
  readonly json: unknown;
}

export function runBdk(args: readonly string[], cwd: string, stdin?: string): RunResult {
  const result = spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: REPO_ROOT },
    input: stdin ?? "",
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
