import type { Handler } from "../../shared/registry/index.ts";
import { renderSchema } from "../render/schema.ts";
import type { ConfigDeps } from "../use-cases/input.ts";
import { isRefusal } from "../use-cases/input.ts";
import { configSchema } from "../use-cases/schema.ts";
import { configInput } from "./input.ts";

export function schemaCommand(deps: ConfigDeps): Handler {
  return (context) => {
    const module = context.positionals["<module>"];
    const outcome = configSchema(configInput(deps, context), {
      ...(module === undefined ? {} : { module }),
      url: context.flags["--url"] === true,
    });
    return isRefusal(outcome) ? outcome : { data: outcome, text: renderSchema(outcome) };
  };
}
