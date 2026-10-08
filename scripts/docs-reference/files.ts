// Where the generated Reference lives and how it is compared and written (design D1, D2).

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** The hand-written page of `docs/reference/`; every other page there is generated. */
export const HAND_WRITTEN = new Set(["index.md"]);

function markdown(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".md"))
    .map((path) => path.split("\\").join("/"))
    .sort();
}

/** The generated pages on disk under `dir`, by path. */
export function committedPages(dir: string): Map<string, string> {
  let paths: string[];
  try {
    paths = markdown(dir);
  } catch {
    return new Map();
  }
  return new Map(
    paths
      .filter((path) => !HAND_WRITTEN.has(path))
      .map((path) => [path, readFileSync(join(dir, path), "utf8")]),
  );
}

/** Paths whose committed page is missing, different, or no longer generated. */
export function drift(generated: Map<string, string>, committed: Map<string, string>): string[] {
  const paths = new Set([...generated.keys(), ...committed.keys()]);
  return [...paths].filter((path) => generated.get(path) !== committed.get(path)).sort();
}

/** Writes `pages` under `dir` and removes generated pages that are no longer produced. */
export function writePages(dir: string, pages: Map<string, string>): string[] {
  const changed = drift(pages, committedPages(dir));
  for (const path of changed) {
    const target = join(dir, path);
    const page = pages.get(path);
    if (page === undefined) {
      rmSync(target);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, page);
    }
  }
  return changed.map((path) => relative(process.cwd(), join(dir, path)));
}
