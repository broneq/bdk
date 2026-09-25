// The two-pass validation of design D-7. Pass one walks each layer against the
// key tree and names unknown keys with their layer and file; pass two runs the
// strict zod schema on the merged tree and maps each issue back to the layer
// that set the offending leaf. Errors are collected, never thrown.
import type * as z from "zod";

import { closest } from "./hint.ts";
import { keySteps } from "./keys.ts";
import type { KeyNode, KeyStep } from "./keys.ts";
import { knownReason, PLANNED_KEYS, within } from "./known.ts";
import type { Layer, LayerName } from "./layers.ts";
import type { Merged } from "./merge.ts";
import type { ConfigProblem } from "./problems.ts";
import type { ConfigRegistry } from "./registry.ts";
import { isRecord, joinKey } from "./values.ts";
import type { Mapping } from "./values.ts";

export interface Validated {
  /** The parsed configuration with defaults; absent when any problem was found. */
  readonly value?: Mapping;
  readonly problems: ConfigProblem[];
}

export function validateLayers(
  registry: ConfigRegistry,
  layers: readonly Layer[],
  merged: Merged,
): Validated {
  const candidates = candidatesOf(registry);
  const problems: ConfigProblem[] = [...merged.problems];
  for (const layer of layers) {
    walk(registry, registry.tree, layer.values, "", (key) => {
      problems.push(unknown(key, layer, candidates));
    });
  }

  const parsed = registry.schema.safeParse(merged.value);
  if (!parsed.success) {
    const reported = problems.map((problem) => problem.key);
    for (const issue of parsed.error.issues) {
      for (const problem of fromIssue(issue, merged, layers, candidates)) {
        // Pass one already named the leaves of an unknown subtree.
        if (reported.some((key) => within(key, problem.key))) continue;
        problems.push(problem);
        reported.push(problem.key);
      }
    }
  }
  return problems.length === 0 && parsed.success ? { value: parsed.data, problems } : { problems };
}

type Report = (key: string) => void;

function walk(
  registry: ConfigRegistry,
  node: KeyNode,
  value: unknown,
  prefix: string,
  report: Report,
): void {
  if (node.kind === "object" && isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      const path = joinKey(prefix, key);
      const childNode = node.children.get(key);
      if (childNode === undefined) leaves(child, path).forEach(report);
      else walk(registry, childNode, child, path, report);
    }
  } else if (node.kind === "idArray" && Array.isArray(value)) {
    value.forEach((item: unknown, index) => {
      const id = isRecord(item) && typeof item.id === "string" ? item.id : String(index);
      walk(registry, node.item, item, joinKey(prefix, id), report);
    });
  } else if (node.kind === "record" && isRecord(value) && prefix === "prompts.files") {
    for (const key of Object.keys(value)) {
      if (registry.promptKey(key) === undefined) report(joinKey(prefix, key));
    }
  }
}

/** The leaf paths of an unknown subtree, so each error names a full key. */
function leaves(value: unknown, prefix: string): string[] {
  if (isRecord(value) && Object.keys(value).length > 0) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, joinKey(prefix, key)));
  }
  return [prefix];
}

/** The steps of a key the registry declares, including a registered `prompts.files` key; else undefined. */
export function declaredSteps(registry: ConfigRegistry, key: string): KeyStep[] | undefined {
  const steps = keySteps(registry.tree, key);
  const file = within(key, "prompts.files") ? key.split(".")[2] : undefined;
  if (file !== undefined && registry.promptKey(file) === undefined) return undefined;
  return steps;
}

/** Why `key` is not a registry key: the owner task, the removed v2 key, or a hint. */
export function unknownKeyMessage(registry: ConfigRegistry, key: string): string {
  return unknownMessage(key, candidatesOf(registry));
}

function candidatesOf(registry: ConfigRegistry): string[] {
  return [...registry.keys, ...PLANNED_KEYS.map((entry) => entry.key)];
}

function unknownMessage(key: string, candidates: readonly string[]): string {
  const known = knownReason(key);
  const hint = known === undefined ? closest(key, candidates) : undefined;
  return known ?? (hint === undefined ? "unknown key" : `unknown key; did you mean ${hint}?`);
}

function unknown(
  key: string,
  layer: { readonly name: LayerName; readonly path?: string },
  candidates: readonly string[],
): ConfigProblem {
  const message = unknownMessage(key, candidates);
  return {
    rule: "policy/unknown-config-key",
    key,
    layer: layer.name,
    ...(layer.path === undefined ? {} : { path: layer.path }),
    message,
  };
}

function fromIssue(
  issue: z.core.$ZodIssue,
  merged: Merged,
  layers: readonly Layer[],
  candidates: readonly string[],
): ConfigProblem[] {
  const key = dotted(issue.path, merged.value);
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((name) => {
      const path = joinKey(key, name);
      return unknown(path, layerOf(path, merged, layers), candidates);
    });
  }
  const layer = layerOf(key, merged, layers);
  return [
    {
      rule: "policy/config-invalid",
      key,
      layer: layer.name,
      ...(layer.path === undefined ? {} : { path: layer.path }),
      message: issue.message,
    },
  ];
}

/** A zod issue path as a dotted key, array indexes replaced by the item's id. */
function dotted(path: readonly PropertyKey[], root: unknown): string {
  let key = "";
  let value = root;
  for (const segment of path) {
    if (Array.isArray(value) && typeof segment === "number") {
      const item: unknown = value[segment];
      key = joinKey(key, isRecord(item) && typeof item.id === "string" ? item.id : String(segment));
      value = item;
    } else {
      key = joinKey(key, String(segment));
      value = isRecord(value) ? value[String(segment)] : undefined;
    }
  }
  return key;
}

const ORDER: readonly LayerName[] = ["default", "global", "project", "local"];

/**
 * The layer responsible for `key`: its own origin, else the highest layer that
 * set anything below it, else the one that set its nearest ancestor.
 */
function layerOf(
  key: string,
  merged: Merged,
  layers: readonly Layer[],
): { readonly name: LayerName; readonly path?: string } {
  let name: LayerName | undefined = merged.origins[key];
  if (name === undefined) {
    const below = Object.entries(merged.origins)
      .filter(([origin]) => within(origin, key))
      .map(([, layer]) => layer);
    name = below.sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0];
  }
  for (let parent = key; name === undefined && parent.includes(".");) {
    parent = parent.slice(0, parent.lastIndexOf("."));
    name = merged.origins[parent] ?? highestBelow(parent, merged);
  }
  const layer = layers.find((candidate) => candidate.name === name);
  return layer === undefined ? { name: "default" } : { name: layer.name, path: layer.path };
}

function highestBelow(key: string, merged: Merged): LayerName | undefined {
  return Object.entries(merged.origins)
    .filter(([origin]) => within(origin, key))
    .map(([, layer]) => layer)
    .sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0];
}
