// Ajv over the JSON Schemas of `schema/cli/` and `schema/state/`: every file is
// registered under its `$id`, so `$ref`s to the common schemas resolve offline.
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv/dist/2020.js";
import formats from "ajv-formats";

import { REPO_ROOT } from "./run.ts";

const SCHEMA_DIR = join(REPO_ROOT, "schema", "cli");
const STATE_DIR = join(REPO_ROOT, "schema", "state");

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
formats.default(ajv);
for (const file of SCHEMA_FILES) ajv.addSchema(readSchema(file));
for (const name of readdirSync(STATE_DIR).filter((file) => file.endsWith(".json"))) {
  ajv.addSchema(readStateSchema(name.slice(0, -".json".length)));
}

/** `schema/state/<kind>.json`, e.g. `entry` or `common`. */
export function readStateSchema(kind: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(STATE_DIR, `${kind}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

/** The validator of a state document kind (`kernel-state`, State JSON Schema). */
export function stateValidatorFor(kind: string): ValidateFunction {
  const id = readStateSchema(kind).$id;
  const validate = typeof id === "string" ? ajv.getSchema(id) : undefined;
  if (validate === undefined) throw new Error(`no state schema registered for ${kind}`);
  return validate;
}

export function validatorFor(file: string): ValidateFunction {
  const id = readSchema(file).$id;
  const validate = typeof id === "string" ? ajv.getSchema(id) : undefined;
  if (validate === undefined) throw new Error(`no schema registered for ${file}`);
  return validate;
}

/** The required top-level fields of a schema, following `allOf` and file `$ref`s. */
export function requiredOf(file: string): string[] {
  const schema = readSchema(file);
  const own = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const parts = Array.isArray(schema.allOf) ? (schema.allOf as Record<string, unknown>[]) : [];
  const inherited = parts.flatMap((part) => {
    if (typeof part.$ref === "string")
      return requiredOf(posix.join(posix.dirname(file), part.$ref));
    return Array.isArray(part.required) ? (part.required as string[]) : [];
  });
  return [...new Set([...own, ...inherited])];
}
