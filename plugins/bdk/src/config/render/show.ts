// Text of `bdk config show` (spec `bdk-cli/config`, "config show"; design D9): one leaf per line
// as `key: <JSON value>  # <origin>`, valid YAML a model reads without a legend.

import type { LayerFile } from "../domain/layer-files.ts";
import { describeProblem } from "../domain/validate.ts";
import type { ShowResult } from "../schema/show.ts";

export const NOT_CONFIGURED = "BDK not configured: run /bdk:setup";
export const INVALID = "BDK configuration invalid: run bdk config check";

function layerList(root: string, layers: readonly LayerFile[]): string {
  const present = layers.filter((file) => file.present);
  if (present.length === 0) return "none";
  return present
    .map(
      ({ layer, path }) =>
        `${layer} ${path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path}`,
    )
    .join(", ");
}

export function renderShow(result: ShowResult): string {
  switch (result.status) {
    case "not-configured":
      return NOT_CONFIGURED;
    case "invalid":
      return [
        INVALID,
        ...result.problems.map((problem) => `  ${describeProblem(problem, result.root)}`),
      ].join("\n");
    case "ok": {
      const head = `# BDK configuration: root ${result.root}; layers ${layerList(result.root, result.layers)}`;
      const lines = result.entries.map(
        (entry) => `${entry.key}: ${JSON.stringify(entry.value)}  # ${entry.origin}`,
      );
      if (lines.length === 0) lines.push(`${result.key ?? ""}: not set`);
      return [head, ...lines].join("\n");
    }
  }
}
