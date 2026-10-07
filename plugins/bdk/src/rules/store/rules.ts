// The rule files of a rules directory (spec `rule-pack`): the BDK pack in the plugin and
// `.bdk/rules/` of the project, read through the `shared/fs` boundary.

import { join } from "node:path";

import type { Files } from "../../shared/fs/index.ts";
import { isRuleFile } from "../domain/rule.ts";

export interface RuleText {
  /** The path inside the directory, `/`-separated. */
  readonly relPath: string;
  /** Undefined when the directory lists the file but it cannot be read (a dangling link). */
  readonly content: string | undefined;
}

export function hasDir(files: Files, dir: string): boolean {
  return files.list(dir) !== undefined;
}

/** Every rule file under `dir`, in path order; none when the directory does not exist. */
export function readRuleFiles(files: Files, dir: string, prefix = ""): RuleText[] {
  const found: RuleText[] = [];
  for (const entry of files.list(dir) ?? []) {
    const relPath = `${prefix}${entry.name}`;
    if (entry.dir) {
      found.push(...readRuleFiles(files, join(dir, entry.name), `${relPath}/`));
    } else if (isRuleFile(relPath)) {
      found.push({ relPath, content: files.readText(join(dir, entry.name)) });
    }
  }
  return found;
}
