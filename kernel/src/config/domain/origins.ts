// `config show --origins`: the layer of every leaf of the shown value. The merge
// records origins only for leaves a file set; the rest came from the defaults.
import type { LayerName } from "./report.ts";

type Origins = Readonly<Record<string, LayerName>>;

export function leafOrigins(value: unknown, key: string, set: Origins): Record<string, LayerName> {
  const out: Record<string, LayerName> = {};
  for (const leaf of leafKeys(value, key)) out[leaf] = originOf(leaf, set);
  return out;
}

/** A leaf's own origin, else the nearest ancestor's (an array replaced whole), else the default. */
function originOf(leaf: string, set: Origins): LayerName {
  for (
    let key = leaf;
    key !== "";
    key = key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : ""
  ) {
    const origin = set[key];
    if (origin !== undefined) return origin;
  }
  return "default";
}

function leafKeys(value: unknown, prefix: string): string[] {
  if (isMapping(value) && Object.keys(value).length > 0) {
    return Object.entries(value).flatMap(([key, child]) => leafKeys(child, join(prefix, key)));
  }
  if (Array.isArray(value) && value.length > 0 && value.every(hasId)) {
    return value.flatMap((item) => leafKeys(item, join(prefix, item.id)));
  }
  return [prefix];
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasId(value: unknown): value is Record<string, unknown> & { id: string } {
  return isMapping(value) && typeof value.id === "string";
}

function join(prefix: string, key: string): string {
  return prefix === "" ? key : `${prefix}.${key}`;
}
