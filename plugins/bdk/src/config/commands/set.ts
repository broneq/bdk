// `bdk config set <key> <value> [--layer]` (spec `bdk-cli/config`, "config set").

import { CliError } from "../../shared/cli/index.ts";
import type { Command } from "../../shared/cli/index.ts";
import type { FileLayerName } from "../domain/layer-files.ts";
import { renderSet } from "../render/set.ts";
import type { ConfigDeps } from "../use-cases/load.ts";
import { set } from "../use-cases/set.ts";

const LAYERS: readonly FileLayerName[] = ["global", "project", "local"];

function layerOf(flag: string | boolean | undefined): FileLayerName {
  if (flag === undefined) return "project";
  const layer = LAYERS.find((name) => name === flag);
  if (layer === undefined) {
    throw new CliError(
      "usage/invalid-argument",
      `--layer must be one of ${LAYERS.join(", ")}`,
      "Run bdk config set --help for its flags.",
    );
  }
  return layer;
}

export function setCommand(deps: ConfigDeps): Command {
  return {
    verb: "set",
    summary: "Write one key into one layer file",
    arguments: [
      { name: "key", description: "Dotted key; an item of an id list by its id", required: true },
      {
        name: "value",
        description: "A YAML value: 5, true, [a, b], {command: x}, or a plain string",
        required: true,
      },
    ],
    flags: {
      layer: { type: "string", description: "global, project (default) or local" },
    },
    run({ args, flags }) {
      const result = set(deps, String(args.key), String(args.value), layerOf(flags.layer));
      return { data: result, text: renderSet(result) };
    },
  };
}
