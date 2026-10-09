// Runs the plugin's eval suite with the Claude Code version pinned in the root package.json
// (design D1-D3 of v3-300-eval-openspec-path). Run as `node evals/run.ts [claude plugin eval args]`
// from the `eval` script, after `build.ts`.
//
// `pnpm run` puts the workspace `node_modules/.bin` directories first on PATH, and a run inherits
// them. A pnpm shim there points into `node_modules/.pnpm/`, which the run's sandbox cannot read
// under the home directory, so a case calling `openspec` would fail. The run gets PATH without
// them and finds a global `openspec` instead.
//
// The sandbox also denies reads under /Users except the directories on PATH, so the shell
// prefix of the `git` host workaround (CLAUDE_CODE_SHELL_PREFIX) is unreadable in a run unless
// its directory is on PATH; the run gets that directory first (design D2 of
// v3-313-execute-evals-lead).
//
// npm checks for its own update on any command whose cache holds no recent check, as under the
// clean HOME of the README's host limits. The sandbox denies that request and reports it in the
// command's output although the command worked, so the run gets the check off (design D1 of
// v3-298-evals-lavish-stub-offline).
import { spawnSync } from "node:child_process";
import { accessSync, constants, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const CLAUDE = join(ROOT, "..", "..", "node_modules", ".bin", "claude");
const README = "evals/README.md, Host limits";

/**
 * PATH without any `node_modules/.bin` directory, every other entry kept in its order, and the
 * directory of an absolute shell prefix first (once).
 */
export function runPath(path: string, shellPrefix?: string): string {
  const entries = path
    .split(delimiter)
    .filter((entry) => !/(^|[\\/])node_modules[\\/]\.bin[\\/]?$/.test(entry));
  if (shellPrefix === undefined || !isAbsolute(shellPrefix)) return entries.join(delimiter);
  const prefixDir = dirname(shellPrefix);
  return [prefixDir, ...entries.filter((entry) => entry !== prefixDir)].join(delimiter);
}

/** The environment of a run: the caller's, with `runPath` and npm's update check off. */
export function runEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    PATH: runPath(env.PATH ?? "", env.CLAUDE_CODE_SHELL_PREFIX),
    npm_config_update_notifier: "false",
  };
}

/** Why a run cannot start `openspec` from this PATH, or undefined when it can. */
export function openspecWarning(path: string, home: string): string | undefined {
  const found = path
    .split(delimiter)
    .filter((entry) => entry !== "")
    .map((entry) => join(resolve(entry), "openspec"))
    .find(executable);
  if (found === undefined) {
    return `warning: no openspec on PATH; cases that call openspec will fail. Install @fission-ai/openspec globally outside your home directory (${README}).`;
  }
  const real = realpathSync(found);
  const fromHome = relative(realpathSync(home), real);
  if (fromHome.split(sep)[0] !== ".." && !isAbsolute(fromHome)) {
    return `warning: openspec on PATH (${real}) lies under your home directory, which a run cannot read; cases that call openspec will fail (${README}).`;
  }
  return undefined;
}

function executable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = runEnv(process.env);
  const warning = openspecWarning(env.PATH ?? "", homedir());
  if (warning !== undefined) console.error(warning);
  const { status, error } = spawnSync(
    CLAUDE,
    ["plugin", "eval", ".", "--scaffold", ...process.argv.slice(2)],
    { cwd: ROOT, stdio: "inherit", env },
  );
  if (error !== undefined) throw error;
  process.exit(status ?? 1);
}
