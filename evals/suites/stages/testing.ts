// Test support: a stand-in for the pinned fixture's files, built from a task
// patch, so a seed that applies patches runs without fetching the fixture.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Per file of a unified diff, the text its hunks expect before the patch: the
 * context and removed lines of each hunk, in order. `git apply` finds each
 * hunk at its offset in that text.
 */
function preimages(patch: string): Map<string, string> {
  const files = new Map<string, string[]>();
  let current: string[] | undefined;
  let inHunk = false;
  for (const line of patch.split("\n")) {
    const target = /^\+\+\+ b\/(.+)$/.exec(line);
    if (target?.[1] !== undefined) {
      current = [];
      files.set(target[1], current);
      inHunk = false;
      continue;
    }
    if (line.startsWith("diff --git ") || line.startsWith("--- ") || line.startsWith("index ")) {
      inHunk = false;
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk || current === undefined) continue;
    if (line.startsWith(" ") || line.startsWith("-")) current.push(line.slice(1));
  }
  return new Map([...files].map(([path, lines]) => [path, `${lines.join("\n")}\n`]));
}

/** Writes into `dir` the preimage of every file the patches change that `dir` does not hold yet. */
export function writePreimages(dir: string, patches: readonly string[]): void {
  for (const patch of patches) {
    for (const [path, text] of preimages(patch)) {
      if (existsSync(join(dir, path))) continue;
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
  }
}
