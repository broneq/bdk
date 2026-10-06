// The layer a resolved key comes from (`config show --origins`, `ctx skill`
// part `setup-coverage`). The merge records an origin only for the paths a
// file set; everything else came from the defaults.
import type { FileLayerName, LayerName } from "./layers.ts";

const RANK: Readonly<Record<FileLayerName, number>> = { global: 1, project: 2, local: 3 };

/**
 * The key's own origin, else the nearest ancestor's (an array replaced whole),
 * else the highest layer that set a path below it (one entry of an id array),
 * else `default`.
 */
export function keyOrigin(
  origins: Readonly<Record<string, FileLayerName>>,
  key: string,
): LayerName {
  for (
    let path = key;
    path !== "";
    path = path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : ""
  ) {
    const origin = origins[path];
    if (origin !== undefined) return origin;
  }
  let highest: FileLayerName | undefined;
  for (const [path, layer] of Object.entries(origins)) {
    if (!path.startsWith(`${key}.`)) continue;
    if (highest === undefined || RANK[layer] > RANK[highest]) highest = layer;
  }
  return highest ?? "default";
}
