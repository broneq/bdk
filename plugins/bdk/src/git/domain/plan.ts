// Plan parts as the review groups read them (spec `bdk-cli/git`, "Review groups"; design D5):
// `<NN>.md` with a YAML frontmatter whose `files` lists repository-relative paths.

import { parse } from "yaml";

export interface Part {
  /** The file stem, `01` for `01.md`. */
  readonly id: string;
  readonly files: readonly string[];
}

/** The part id of a file name, or undefined when the file is no part. */
export function partId(name: string): string | undefined {
  return /^(\d{2,})\.md$/.exec(name)?.[1];
}

/** The `files` of a part file, or the reason it cannot be read. */
export function partFiles(
  text: string,
): { readonly files: readonly string[] } | { readonly problem: string } {
  const lines = text.split(/\r?\n/);
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end === -1) return { problem: "has no frontmatter between --- lines" };
  let data: unknown;
  try {
    data = parse(lines.slice(1, end).join("\n"));
  } catch (error) {
    return { problem: `has frontmatter that is not YAML: ${(error as Error).message}` };
  }
  const files = (data as { files?: unknown } | null)?.files;
  if (files === undefined || files === null) return { files: [] };
  if (!Array.isArray(files) || !files.every((file) => typeof file === "string")) {
    return { problem: "has frontmatter files that is not a list of strings" };
  }
  return { files };
}
