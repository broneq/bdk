import type { Handler } from "../../shared/registry/index.ts";
import { renderCheck } from "../render/check.ts";
import { checkConfig } from "../use-cases/check.ts";
import type { ConfigDeps } from "../use-cases/input.ts";
import { isRefusal } from "../use-cases/input.ts";
import { configInput } from "./input.ts";

export function checkCommand(deps: ConfigDeps): Handler {
  return (context) => {
    const outcome = checkConfig(configInput(deps, context));
    return isRefusal(outcome) ? outcome : { data: outcome, text: renderCheck(outcome) };
  };
}
