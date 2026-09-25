// Ajv over the JSON Schemas of `schema/cli/`: every file is registered under
// its `$id`, so `$ref`s between output and common schemas resolve offline.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv/dist/2020.js";

import { REPO_ROOT } from "./run.ts";

export const SCHEMA_DIR = join(REPO_ROOT, "schema", "cli");

/** Relative paths under `schema/cli/` of the output and common schemas. */
export const SCHEMA_FILES = ["output", "common"].flatMap((dir) =>
  readdirSync(join(SCHEMA_DIR, dir))
    .filter((name) => name.endsWith(".json"))
    .map((name) => `${dir}/${name}`),
);

export function readSchema(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, file), "utf8")) as Record<string, unknown>;
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
for (const file of SCHEMA_FILES) ajv.addSchema(readSchema(file));

export function validatorFor(file: string): ValidateFunction {
  const id = readSchema(file).$id;
  const validate = typeof id === "string" ? ajv.getSchema(id) : undefined;
  if (validate === undefined) throw new Error(`no schema registered for ${file}`);
  return validate;
}
