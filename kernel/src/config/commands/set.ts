import type { Handler } from "../../shared/registry/index.ts";
import { renderSet } from "../render/set.ts";
import type { ConfigDeps } from "../use-cases/input.ts";
import { isRefusal } from "../use-cases/input.ts";
import { setConfig } from "../use-cases/set.ts";
import { configInput } from "./input.ts";

export function setCommand(deps: ConfigDeps): Handler {
  return (context) => {
    const outcome = setConfig(configInput(deps, context), {
      key: context.positionals["<key>"] ?? "",
      value: context.positionals["<value>"] ?? "",
      global: context.flags["--global"] === true,
      local: context.flags["--local"] === true,
    });
    return isRefusal(outcome) ? outcome : { data: outcome, text: renderSet(outcome) };
  };
}
