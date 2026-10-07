// The plan parts of a Change, `plan/parts/<NN>.md` (spec `bdk-cli/git`, "Review groups";
// design D5; the format is #180's).

import { join } from "node:path";

import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { partFiles, partId } from "../domain/plan.ts";
import type { Part } from "../domain/plan.ts";

/** The parts in `dir`, in the order of their file names. */
export function readParts(files: Files, dir: string): Part[] {
  const entries = files.list(dir);
  if (entries === undefined) {
    throw new CliError(
      "env/plan-missing",
      `the plan directory ${dir} does not exist`,
      "pass the plan/parts directory of the Change, or leave out --plan to group by module",
    );
  }
  return entries.flatMap((entry) => {
    const id = entry.dir ? undefined : partId(entry.name);
    if (id === undefined) return [];
    const path = join(dir, entry.name);
    const parsed = partFiles(files.readText(path) ?? "");
    if ("problem" in parsed) {
      throw new CliError(
        "env/plan-invalid",
        `plan part ${path} ${parsed.problem}`,
        "fix the frontmatter: files is a YAML list of repository-relative paths",
      );
    }
    return [{ id, files: parsed.files }];
  });
}
