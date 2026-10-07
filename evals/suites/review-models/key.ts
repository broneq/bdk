// The answer key of review-models (design D10 of v3-t42-review-skills): the
// seed an executed Change starts from, the patch its tasks deliver the seeded
// defects with, and per defect its file, line range, class and summary. A key is
// checked against its patch and seed without a model: every defect's file is
// one the seed delivers and the patch changes, at the lines it names.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { SEEDS, isSeed } from "../stages/seeds.ts";
import type { SeedName } from "../stages/seeds.ts";

export const DEFECT_CLASSES = ["logic", "test-gap", "integration"] as const;
type DefectClass = (typeof DEFECT_CLASSES)[number];

export interface Defect {
  readonly id: string;
  readonly class: DefectClass;
  readonly file: string;
  /** First and last line, inclusive, in the patched file. */
  readonly lines: readonly [number, number];
  readonly summary: string;
}

export interface AnswerKey {
  readonly seed: SeedName;
  /** The patch file, relative to the suite directory. */
  readonly patch: string;
  readonly defects: readonly Defect[];
}

export const KEY_FILE = fileURLToPath(new URL("./key.yaml", import.meta.url));

class KeyError extends Error {
  constructor(file: string, problems: readonly string[]) {
    super(`${file}: ${problems.join("; ")}`);
    this.name = "KeyError";
  }
}

const ID = /^[a-z0-9][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLines(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((line) => Number.isInteger(line) && (line as number) > 0) &&
    (value[0] as number) <= (value[1] as number)
  );
}

function defectProblems(value: unknown, at: string): string[] {
  if (!isRecord(value)) return [`${at} is not a mapping`];
  const problems: string[] = [];
  if (typeof value.id !== "string" || !ID.test(value.id)) {
    problems.push(`${at}: id must be lowercase letters, digits and dashes`);
  }
  if (!(DEFECT_CLASSES as readonly unknown[]).includes(value.class)) {
    problems.push(`${at}: class must be one of ${DEFECT_CLASSES.join(", ")}`);
  }
  if (typeof value.file !== "string" || value.file === "") {
    problems.push(`${at}: file must be a path`);
  }
  if (!isLines(value.lines))
    problems.push(`${at}: lines must be [first, last], 1 <= first <= last`);
  if (typeof value.summary !== "string" || value.summary.trim() === "") {
    problems.push(`${at}: summary must be a non-empty text`);
  }
  return problems;
}

export function parseKey(text: string, file: string): AnswerKey {
  const data: unknown = parse(text);
  if (!isRecord(data)) throw new KeyError(file, ["the key is a mapping"]);
  const problems: string[] = [];
  if (!isSeed(data.seed)) problems.push(`seed must be one of ${SEEDS.join(", ")}`);
  if (typeof data.patch !== "string" || data.patch === "") problems.push("patch must name a file");
  const defects: unknown[] = Array.isArray(data.defects) ? data.defects : [];
  if (defects.length === 0) problems.push("defects must be a non-empty list");
  defects.forEach((defect, index) => {
    problems.push(...defectProblems(defect, `defect ${String(index + 1)}`));
  });
  const ids = defects.map((defect) => (isRecord(defect) ? defect.id : undefined));
  ids.forEach((id, index) => {
    if (typeof id === "string" && ids.indexOf(id) !== index)
      problems.push(`${id}: id is not unique`);
  });
  if (problems.length > 0) throw new KeyError(file, problems);
  return {
    seed: data.seed as SeedName,
    patch: data.patch as string,
    defects: defects as Defect[],
  };
}

export function readKey(file = KEY_FILE): AnswerKey {
  return parseKey(readFileSync(file, "utf8"), file);
}

/** The patch file of a key, read from the suite directory. */
export function readPatch(key: AnswerKey): string {
  return readFileSync(fileURLToPath(new URL(`./${key.patch}`, import.meta.url)), "utf8");
}

/** Per file of a unified diff, the new-side line range of each hunk; a binary file has none. */
export function hunkRanges(patch: string): Map<string, [number, number][]> {
  const ranges = new Map<string, [number, number][]>();
  let file: string | undefined;
  for (const line of patch.split("\n")) {
    // A binary section names its file only in its `diff --git` line.
    const target =
      /^\+\+\+ b\/(.+)$/.exec(line)?.[1] ?? /^diff --git a\/\S+ b\/(.+)$/.exec(line)?.[1];
    if (target !== undefined) {
      file = target;
      ranges.set(file, []);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk === null || file === undefined) continue;
    const start = Number(hunk[1]);
    const length = hunk[2] === undefined ? 1 : Number(hunk[2]);
    ranges.get(file)?.push([start, start + Math.max(length, 1) - 1]);
  }
  return ranges;
}

/**
 * What is wrong with a key against its patch and the files its seed delivers:
 * a defect's file the seed does not deliver or the patch does not change, or
 * lines that touch no hunk of the patch.
 */
export function keyProblems(
  key: AnswerKey,
  patch: string,
  delivered: ReadonlySet<string>,
): string[] {
  const ranges = hunkRanges(patch);
  const problems: string[] = [];
  for (const defect of key.defects) {
    if (!delivered.has(defect.file)) {
      problems.push(`${defect.id}: ${defect.file} is not a file the seed ${key.seed} delivers`);
    }
    const hunks = ranges.get(defect.file);
    if (hunks === undefined) {
      problems.push(`${defect.id}: the patch does not change ${defect.file}`);
      continue;
    }
    const [first, last] = defect.lines;
    if (!hunks.some(([from, to]) => first <= to && from <= last)) {
      problems.push(
        `${defect.id}: lines ${String(first)}-${String(last)} touch no hunk of the patch in ${defect.file}`,
      );
    }
  }
  return problems;
}

/** The files a set of task patches adds or changes. */
export function patchedFiles(patches: readonly string[]): Set<string> {
  return new Set(patches.flatMap((patch) => [...hunkRanges(patch).keys()]));
}
