// `bdk config schema`: the settings JSON Schema of the running kernel, whole or one module.
import {
  OFFLINE_SCHEMA_PATH,
  readKernelVersion,
  schemaModules,
  settingsJsonSchema,
  settingsSchemaUrl,
} from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { SchemaReport } from "../domain/report.ts";
import type { ConfigInput } from "./input.ts";

export interface SchemaRequest {
  readonly module?: string;
  readonly url: boolean;
}

export function configSchema(input: ConfigInput, request: SchemaRequest): SchemaReport | Refusal {
  const url = settingsSchemaUrl(readKernelVersion(input.store, input.pluginRoot));
  const location = { url, offlineCopy: OFFLINE_SCHEMA_PATH };
  const { module } = request;
  const known = schemaModules(input.settings);
  if (module !== undefined && !known.includes(module)) {
    return refuse(
      "input/not-found",
      `${module} is not a registered settings module; registered: ${known.join(", ")}`,
      ["bdk config schema"],
    );
  }
  if (request.url) return location;

  const schema = settingsJsonSchema(input.settings);
  if (module === undefined) return { schema, ...location };
  return { module, schema: subschema(schema, module), ...location };
}

/** The schema of a dotted module key, walked through nested `properties`. */
function subschema(schema: Record<string, unknown>, module: string): Record<string, unknown> {
  let node: Record<string, unknown> = schema;
  for (const segment of module.split(".")) {
    const properties = (node.properties ?? {}) as Record<string, Record<string, unknown>>;
    node = properties[segment] ?? {};
  }
  return node;
}
