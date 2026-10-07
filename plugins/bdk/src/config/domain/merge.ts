// Merging layers and naming their leaves (spec `bdk-cli/config`, "Merge"; design D3). Pure
// functions over plain YAML data: mappings merge deeply, arrays of items with an `id` merge on
// `id`, everything else is replaced by the higher layer.

import { z } from "zod";

import { KEBAB } from "./settings.ts";

export const LayerNameSchema = z.enum(["default", "global", "project", "local"]);

export type LayerName = z.infer<typeof LayerNameSchema>;

export type Mapping = Readonly<Record<string, unknown>>;

/** One layer's data, as parsed from its file (the default layer has no file). */
export interface Layer {
  readonly name: LayerName;
  readonly file?: string;
  readonly data: Mapping;
}

export function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type Item = Mapping & { readonly id: string };

function isItem(value: unknown): value is Item {
  return isMapping(value) && typeof value.id === "string";
}

/** An array merged item by item on `id`: every item is a mapping with a string `id`. */
export function isIdArray(value: unknown): value is readonly Item[] {
  return Array.isArray(value) && value.every(isItem);
}

export function mergeValue(lower: unknown, higher: unknown): unknown {
  if (isMapping(lower) && isMapping(higher)) {
    const out: Record<string, unknown> = { ...lower };
    for (const [key, value] of Object.entries(higher)) {
      out[key] = key in lower ? mergeValue(lower[key], value) : value;
    }
    return out;
  }
  if (isIdArray(lower) && isIdArray(higher)) {
    const out = [...lower];
    for (const item of higher) {
      const at = out.findIndex((candidate) => candidate.id === item.id);
      if (at === -1) out.push(item);
      else out[at] = mergeValue(out[at], item) as Item;
    }
    return out;
  }
  return higher;
}

export function mergeLayers(layers: readonly Layer[]): Mapping {
  return layers.reduce<Mapping>((acc, layer) => mergeValue(acc, layer.data) as Mapping, {});
}

/** A leaf of a configuration: its dotted key and its value. */
export interface Leaf {
  readonly key: string;
  readonly value: unknown;
}

const join = (prefix: string, segment: string): string =>
  prefix === "" ? segment : `${prefix}.${segment}`;

/**
 * Every leaf in key order: a non-empty mapping is walked, a non-empty array of items with an
 * `id` is walked by id with the id as a key segment, and anything else is one leaf.
 */
export function flatten(value: unknown, prefix = ""): Leaf[] {
  if (isMapping(value) && Object.keys(value).length > 0) {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, join(prefix, key)));
  }
  if (isIdArray(value) && value.length > 0) {
    return value.flatMap(({ id, ...fields }) =>
      Object.keys(fields).length === 0
        ? [{ key: join(prefix, id), value: {} }]
        : flatten(fields, join(prefix, id)),
    );
  }
  return prefix === "" ? [] : [{ key: prefix, value }];
}

/** Whether `keys` hold `key` itself, a key under it, or a leaf above it. */
export function touches(keys: ReadonlySet<string>, key: string): boolean {
  for (const candidate of keys) {
    if (
      candidate === key ||
      candidate.startsWith(`${key}.`) ||
      key.startsWith(`${candidate}.`) ||
      key.startsWith(`${candidate}[`)
    ) {
      return true;
    }
  }
  return false;
}

/** The highest of `layers` that sets `key`, a key under it or a leaf above it. */
export function layerOf(layers: readonly Layer[], key: string): Layer | undefined {
  return [...layers]
    .reverse()
    .find((layer) => touches(new Set(flatten(layer.data).map((leaf) => leaf.key)), key));
}

/** The resolved leaves, each with the highest layer that set it exactly. */
export function withOrigins(
  resolved: unknown,
  layers: readonly Layer[],
): (Leaf & { readonly origin: LayerName })[] {
  const keysOf = layers.map(
    (layer) => [layer.name, new Set(flatten(layer.data).map((leaf) => leaf.key))] as const,
  );
  return flatten(resolved).map((leaf) => ({
    ...leaf,
    origin: [...keysOf].reverse().find(([, keys]) => keys.has(leaf.key))?.[0] ?? "default",
  }));
}

/** The dotted key of a path into `value`: an index into an id array becomes the item's id. */
export function keyOfPath(value: unknown, path: readonly PropertyKey[]): string {
  let key = "";
  let at: unknown = value;
  for (const segment of path) {
    if (typeof segment === "number") {
      const item: unknown = Array.isArray(at) ? at[segment] : undefined;
      const id = isItem(item) ? item.id : undefined;
      key = id !== undefined && KEBAB.test(id) ? join(key, id) : `${key}[${segment}]`;
      at = item;
    } else {
      const name = String(segment);
      key = join(key, name);
      at = isMapping(at) ? at[name] : undefined;
    }
  }
  return key;
}

/** Each key of an id array in `data` that holds two items with the same id, and that id. */
export function duplicateIds(data: unknown, prefix = ""): { key: string; id: string }[] {
  if (isMapping(data)) {
    return Object.entries(data).flatMap(([key, child]) => duplicateIds(child, join(prefix, key)));
  }
  if (!isIdArray(data)) return [];
  const seen = new Set<string>();
  const found: { key: string; id: string }[] = [];
  for (const item of data) {
    if (seen.has(item.id) && !found.some((entry) => entry.id === item.id)) {
      found.push({ key: prefix, id: item.id });
    }
    seen.add(item.id);
  }
  return [...found, ...data.flatMap(({ id, ...fields }) => duplicateIds(fields, join(prefix, id)))];
}
