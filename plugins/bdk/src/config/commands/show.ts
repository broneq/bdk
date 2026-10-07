// `bdk config show [<key>]` (spec `bdk-cli/config`, "config show").

import type { Command } from "../../shared/cli/index.ts";
import { renderShow } from "../render/show.ts";
import type { ConfigDeps } from "../use-cases/load.ts";
import { show } from "../use-cases/show.ts";

export function showCommand(deps: ConfigDeps): Command {
  return {
    verb: "show",
    summary: "Print the resolved configuration, each value with its origin layer",
    arguments: [{ name: "key", description: "Print only this key and the keys under it" }],
    run({ args }) {
      const result = show(deps, args.key);
      return { data: result, text: renderShow(result) };
    },
  };
}
