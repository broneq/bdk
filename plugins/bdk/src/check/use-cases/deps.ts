// What the check slice needs from the OS, injected by `src/main.ts`, and the argument checks
// `bdk check plan` and `bdk check record` share (spec `bdk-cli/check`, "Errors of the check
// command").

import { resolve } from "node:path";

import type { ConfigDeps } from "../../config/index.ts";
import { CliError } from "../../shared/cli/index.ts";
import { isDirectory } from "../store/results.ts";

export interface CheckDeps extends ConfigDeps {
  /** Runs `git <args>` in `cwd`: `git` of `shared/git` or a fake in tests. */
  readonly git: (cwd: string, args: readonly string[]) => string;
}

const KEBAB = /^[a-z0-9][a-z0-9-]*$/;

export function invalid(message: string, verb: "plan" | "record"): CliError {
  return new CliError("usage/invalid-argument", message, `Run bdk check ${verb} --help.`);
}

export function checkId(id: string, verb: "plan" | "record"): void {
  if (!KEBAB.test(id)) throw invalid(`<id> must be kebab-case (a-z, 0-9, -), not ${id}`, verb);
}

/** The absolute form of a path given relative to the working directory. */
export function absolute(deps: CheckDeps, path: string): string {
  return resolve(deps.cwd, path);
}

export function checkRunDir(deps: CheckDeps, runDir: string): void {
  if (!isDirectory(deps.files, absolute(deps, runDir))) {
    throw new CliError(
      "env/run-dir-missing",
      `run directory ${runDir} does not exist`,
      "Pass the run directory of the Change, such as .bdk/runs/<change>.",
    );
  }
}
