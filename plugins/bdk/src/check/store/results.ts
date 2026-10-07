// Where a check run writes inside the run directory (spec `bdk-cli/check`, "Output files",
// "Result file", "Red checks as findings"). Paths are joined onto the run directory as the
// caller gave it, so an absolute run directory gives absolute paths.

import { join } from "node:path";

import type { Files } from "../../shared/fs/index.ts";
import type { Kind } from "../domain/plan.ts";

export function resultPath(runDir: string, id: string): string {
  return join(runDir, "checks", `${id}.json`);
}

export function outputPath(runDir: string, id: string, kind: Kind, tool: string): string {
  return join(runDir, "checks", id, `${kind}-${tool}.txt`);
}

export function findingsLog(runDir: string, round: number): string {
  return join(runDir, "review", `round-${String(round)}`, "findings.jsonl");
}

/** True when `dir` is an existing directory. */
export function isDirectory(files: Files, dir: string): boolean {
  return files.list(dir) !== undefined;
}

export function writeResult(files: Files, path: string, result: unknown): void {
  files.writeText(path, `${JSON.stringify(result)}\n`);
}
