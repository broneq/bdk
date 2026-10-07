// The plan parts directory `bdk plan check` reads (spec `bdk-cli/plan`, "Part files"): the part
// files `NN.md` with their text, and the other `.md` names. Read only.

import { join, resolve } from "node:path";

import { CliError } from "../../shared/cli/index.ts";
import type { Files } from "../../shared/fs/index.ts";
import { partId } from "../domain/part.ts";

export interface PartFiles {
  /** Part id and file text, in the order of the file names. */
  readonly parts: readonly { readonly id: string; readonly text: string }[];
  /** The `.md` files whose name is no part file name. */
  readonly strays: readonly string[];
}

/** The files directly in `dir`, resolved against `cwd`; subdirectories and other files ignored. */
export function readPartFiles(files: Files, cwd: string, dir: string): PartFiles {
  const path = resolve(cwd, dir);
  const entries = files.list(path);
  if (entries === undefined) {
    throw new CliError(
      "env/plan-missing",
      `the plan directory ${dir} does not exist`,
      "Pass the plan/parts directory of the Change.",
    );
  }
  const parts: { id: string; text: string }[] = [];
  const strays: string[] = [];
  for (const entry of entries) {
    if (entry.dir || !entry.name.endsWith(".md")) continue;
    const id = partId(entry.name);
    if (id === undefined) strays.push(entry.name);
    else parts.push({ id, text: files.readText(join(path, entry.name)) ?? "" });
  }
  return { parts, strays };
}
