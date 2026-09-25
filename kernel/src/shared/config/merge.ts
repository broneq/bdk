// The merge of `kernel-settings`, Merge (design D-5): mappings deep-merge,
// arrays of mappings with an `id` merge by id, everything else is replaced
// whole. `origins` records, per leaf, the layer that set it.
import type { FileLayerName, Layer } from "./layers.ts";
import type { ConfigProblem } from "./problems.ts";
import { isIdArray, isRecord, joinKey } from "./values.ts";
import type { Mapping } from "./values.ts";

export interface Merged {
  readonly value: Mapping;
  /** Dotted key (id segments for id arrays) -> the layer that set the leaf. */
  readonly origins: Record<string, FileLayerName>;
  readonly problems: ConfigProblem[];
}

export function mergeLayers(layers: readonly Layer[]): Merged {
  const origins: Record<string, FileLayerName> = {};
  const problems: ConfigProblem[] = [];
  let value: Mapping = {};
  for (const layer of layers) {
    const context = { layer, origins, problems };
    value = mergeMapping(value, layer.values, "", context);
  }
  return { value, origins, problems };
}

interface Context {
  readonly layer: Layer;
  readonly origins: Record<string, FileLayerName>;
  readonly problems: ConfigProblem[];
}

function mergeMapping(lower: Mapping, higher: Mapping, prefix: string, context: Context): Mapping {
  const out: Mapping = { ...lower };
  for (const [key, next] of Object.entries(higher)) {
    const path = joinKey(prefix, key);
    out[key] = mergeValue(lower[key], next, path, context);
  }
  return out;
}

function mergeValue(lower: unknown, next: unknown, path: string, context: Context): unknown {
  if (isRecord(next) && Object.keys(next).length > 0) {
    if (!isRecord(lower)) forget(context.origins, path);
    return mergeMapping(isRecord(lower) ? lower : {}, next, path, context);
  }
  if (isIdArray(next)) {
    reportDuplicates(next, path, context);
    if (!isIdArray(lower)) forget(context.origins, path);
    return mergeById(isIdArray(lower) ? lower : [], next, path, context);
  }
  forget(context.origins, path);
  context.origins[path] = context.layer.name;
  return next;
}

function mergeById(
  lower: readonly (Mapping & { id: string })[],
  higher: readonly (Mapping & { id: string })[],
  path: string,
  context: Context,
): Mapping[] {
  const out: Mapping[] = [...lower];
  for (const item of higher) {
    const itemPath = joinKey(path, item.id);
    const at = out.findIndex((existing) => existing.id === item.id);
    const merged = mergeMapping(at === -1 ? {} : (out[at] ?? {}), item, itemPath, context);
    if (at === -1) out.push(merged);
    else out[at] = merged;
  }
  return out;
}

function reportDuplicates(items: readonly { id: string }[], path: string, context: Context): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) {
      context.problems.push({
        rule: "policy/config-invalid",
        key: path,
        layer: context.layer.name,
        path: context.layer.path,
        message: `the id ${id} appears twice in one layer`,
      });
    }
    seen.add(id);
  }
}

/** Drops the origins of a subtree a higher layer replaces. */
function forget(origins: Record<string, FileLayerName>, path: string): void {
  for (const key of Object.keys(origins)) {
    if (key === path || key.startsWith(`${path}.`)) Reflect.deleteProperty(origins, key);
  }
}
