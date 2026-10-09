// Validation of the layers (spec `bdk-cli/config`, "config check"; design D3): merge first,
// then validate every prefix of the layers, so a partial item is checked on top of the layers
// below it and a value a higher layer overrides is still checked; each problem names the layer
// its value comes from.

import { z } from "zod";
import type { core } from "zod";

import { knownUnder } from "./keys.ts";
import { DEFAULTS, SettingsSchema } from "./settings.ts";
import type { Settings } from "./settings.ts";
import {
  duplicateIds,
  isMapping,
  keyOfPath,
  LayerNameSchema,
  layerOf,
  mergeLayers,
} from "./merge.ts";
import type { Layer } from "./merge.ts";

export const ProblemSchema = z.strictObject({
  layer: LayerNameSchema,
  /** The layer file; absent for the default layer. */
  file: z.string().optional(),
  /** The full dotted key; empty for a problem of the whole file. */
  key: z.string(),
  message: z.string(),
});

export type Problem = z.infer<typeof ProblemSchema>;

/** `<file>: <key>: <message>`, the file relative to `root` when it is under it. */
export function describeProblem(problem: Problem, root: string): string {
  const file =
    problem.file === undefined
      ? problem.layer
      : problem.file.startsWith(`${root}/`)
        ? problem.file.slice(root.length + 1)
        : problem.file;
  return [file, ...(problem.key === "" ? [] : [problem.key]), problem.message].join(": ");
}

/** The closest of `names` to `name`, if close enough to be a typo (the frame's `closest`). */
export type Suggest = (name: string, names: readonly string[]) => string | undefined;

export const DEFAULT_LAYER: Layer = { name: "default", data: DEFAULTS };

function valueAt(value: unknown, path: readonly PropertyKey[]): unknown {
  let at = value;
  for (const segment of path) {
    if (Array.isArray(at) && typeof segment === "number") at = at[segment];
    else if (isMapping(at)) at = at[String(segment)];
    else return undefined;
  }
  return at;
}

function parentOf(key: string): string {
  const cut = Math.max(key.lastIndexOf("."), key.lastIndexOf("["));
  return cut === -1 ? "" : key.slice(0, cut);
}

function problemAt(layers: readonly Layer[], key: string, message: string): Problem {
  // The default layer is the fallback only: its empty lists would claim every key under them.
  const files = layers.filter((candidate) => candidate.name !== "default");
  let layer: Layer | undefined;
  for (let at = key; layer === undefined && at !== ""; at = parentOf(at)) {
    layer = layerOf(files, at);
  }
  const owner = layer ?? DEFAULT_LAYER;
  return {
    layer: owner.name,
    ...(owner.file === undefined ? {} : { file: owner.file }),
    key,
    message,
  };
}

function issueProblems(
  issue: core.$ZodIssue,
  merged: unknown,
  layers: readonly Layer[],
  last: boolean,
  suggest: Suggest,
): Problem[] {
  const parent = keyOfPath(merged, issue.path);
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((name) => {
      const near = suggest(name, knownUnder(parent));
      const full = parent === "" ? name : `${parent}.${name}`;
      const hint =
        near === undefined ? "" : `; did you mean ${parent === "" ? near : `${parent}.${near}`}?`;
      return problemAt(layers, full, `unknown key${hint}`);
    });
  }
  if (issue.code === "invalid_key") {
    const [inner] = issue.issues;
    return [problemAt(layers, parent, `invalid key: ${inner?.message ?? issue.message}`)];
  }
  if (issue.code === "custom" && (issue.params as { resolved?: boolean } | undefined)?.resolved) {
    // A rule entry's cross-field check: a later layer may still supply the field (`kind` too).
    return last ? [problemAt(layers, parent, issue.message)] : [];
  }
  if (issue.code === "invalid_type" && valueAt(merged, issue.path) === undefined) {
    // A later layer may still supply a missing field; only the full merge decides.
    return last ? [problemAt(layers, parent, "required, missing")] : [];
  }
  return [problemAt(layers, parent, issue.message)];
}

export interface Validation {
  readonly problems: readonly Problem[];
  /** The resolved configuration, when there is no problem. */
  readonly settings?: Settings;
}

/** Validates the layer files in order (`global`, `project`, `local`) on top of the defaults. */
export function validate(layers: readonly Layer[], suggest: Suggest): Validation {
  const all = [DEFAULT_LAYER, ...layers];
  const problems: Problem[] = layers.flatMap((layer) =>
    duplicateIds(layer.data).map(({ key, id }) => ({
      layer: layer.name,
      ...(layer.file === undefined ? {} : { file: layer.file }),
      key,
      message: `duplicate id ${id}`,
    })),
  );
  let settings: Settings | undefined;
  for (let size = Math.min(2, all.length); size <= all.length; size++) {
    const prefix = all.slice(0, size);
    const merged = mergeLayers(prefix);
    const result = SettingsSchema.safeParse(merged);
    if (result.success) {
      settings = result.data;
      continue;
    }
    settings = undefined;
    for (const issue of result.error.issues) {
      problems.push(...issueProblems(issue, merged, prefix, size === all.length, suggest));
    }
  }
  const seen = new Set<string>();
  const unique = problems.filter((problem) => {
    const id = `${problem.layer}\u0000${problem.key}\u0000${problem.message}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return unique.length === 0 && settings !== undefined
    ? { problems: [], settings }
    : { problems: unique };
}
