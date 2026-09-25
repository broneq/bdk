import { stringify } from "yaml";

import type { Handler } from "../../shared/registry/index.ts";
import type { ConfigDeps } from "../use-cases/input.ts";
import { isRefusal } from "../use-cases/input.ts";
import { showConfig } from "../use-cases/show.ts";
import { configInput } from "./input.ts";

/** Text mode prints the value as YAML, so a skill's `!` block reads a tool list as is. */
export function showCommand(deps: ConfigDeps): Handler {
  return (context) => {
    const key = context.positionals["<key>"];
    const outcome = showConfig(configInput(deps, context), {
      ...(key === undefined ? {} : { key }),
      origins: context.flags["--origins"] === true,
    });
    if (isRefusal(outcome)) return outcome;
    const origins = outcome.origins === undefined ? "" : `# origins\n${stringify(outcome.origins)}`;
    return { data: outcome, text: `${stringify(outcome.value)}${origins}` };
  };
}
