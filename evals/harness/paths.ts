// Fixed locations of the harness (design D-1): everything a run produces
// lives under `evals/.runs/` (gitignored); only result rows are committed.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { FixturePin } from "./fixture.ts";

export const EVALS_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const REPO_ROOT = dirname(EVALS_DIR);
export const RUNS_DIR = join(EVALS_DIR, ".runs");
/** One ledger for every suite, so one budget covers all of T40 (design D-10). */
export const LEDGER_FILE = join(RUNS_DIR, "budget.json");

export interface Versions {
  readonly fixture: FixturePin;
  readonly v2Tag: string;
}

export function readVersions(file = join(EVALS_DIR, "versions.json")): Versions {
  return JSON.parse(readFileSync(file, "utf8")) as Versions;
}

export function resultsFile(suite: string, series: string, evalsDir = EVALS_DIR): string {
  return join(evalsDir, "results", suite, `${series}.jsonl`);
}
