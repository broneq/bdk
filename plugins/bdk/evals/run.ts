// Runs the plugin's eval suite with the Claude Code version pinned in the root package.json
// (design D1-D3 of v3-300-eval-openspec-path). Run as `node evals/run.ts [claude plugin eval args]`
// from the `eval` script, after `build.ts`.
//
// `pnpm run` puts the workspace `node_modules/.bin` directories first on PATH, and a run inherits
// them. A pnpm shim there points into `node_modules/.pnpm/`, which the run's sandbox cannot read
// under the home directory, so a case calling `openspec` would fail. The run gets PATH without
// them and finds a global `openspec` instead.
import { spawnSync } from "node:child_process";
import { accessSync, constants, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const CLAUDE = join(ROOT, "..", "..", "node_modules", ".bin", "claude");
const README = "evals/README.md, Host limits";

/** PATH without any `node_modules/.bin` directory, every other entry kept in its order. */
export function runPath(path: string): string {
  return path
    .split(delimiter)
    .filter((entry) => !/(^|[\\/])node_modules[\\/]\.bin[\\/]?$/.test(entry))
    .join(delimiter);
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
  const path = runPath(process.env.PATH ?? "");
  const warning = openspecWarning(path, homedir());
  if (warning !== undefined) console.error(warning);
  const { status, error } = spawnSync(
    CLAUDE,
    ["plugin", "eval", ".", "--scaffold", ...process.argv.slice(2)],
    { cwd: ROOT, stdio: "inherit", env: { ...process.env, PATH: path } },
  );
  if (error !== undefined) throw error;
  process.exit(status ?? 1);
}
