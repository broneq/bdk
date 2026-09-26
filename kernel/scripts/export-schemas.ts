// Writes the generated JSON Schemas (design D-10 of v3-t12-layered-config,
// design D-6 of v3-t14-state-schema): the settings schema from the config
// registry, the CLI output schemas whose zod exists and the state documents. `kernel/build.mjs` runs it after bundling the kernel, and
// CI fails on `git diff --exit-code dist/ schema/`, so the output must be
// deterministic. The CLI files not listed here stay hand-written.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { format, resolveConfig } from "prettier";
import * as z from "zod";

import { configCheckOutput } from "../src/config/schema/check.ts";
import { configSchemaOutput } from "../src/config/schema/schema.ts";
import { configSetOutput } from "../src/config/schema/set.ts";
import { configShowOutput } from "../src/config/schema/show.ts";
import { settingsRegistry } from "../src/registrations.ts";
import { doctorOutput } from "../src/service/schema/doctor.ts";
import { versionOutput } from "../src/service/schema/version.ts";
import { settingsJsonSchema } from "../src/shared/config/index.ts";
import { refusalSchema } from "../src/shared/refusal/index.ts";
import * as common from "../src/shared/store/state/common.ts";
import { STATE_KINDS } from "../src/shared/store/state/registry.ts";

const CLI_BASE = "https://raw.githubusercontent.com/broneq/bdk/v3/schema/cli/";
const STATE_BASE = "https://raw.githubusercontent.com/broneq/bdk/v3/schema/state/";
const COMMON = "common.json";

/** Paths under `schema/cli/`; a schema embedding another one gets a `$ref` to its file. */
const CLI_FILES: readonly (readonly [string, z.ZodType])[] = [
  ["common/version.json", versionOutput],
  ["common/refusal.json", refusalSchema],
  ["output/doctor.json", doctorOutput],
  ["output/config-show.json", configShowOutput],
  ["output/config-check.json", configCheckOutput],
  ["output/config-schema.json", configSchemaOutput],
  ["output/config-set.json", configSetOutput],
];

function cliSchemas(): Record<string, Record<string, unknown>> {
  const files = z.registry<{ id: string }>();
  for (const [path, schema] of CLI_FILES) files.add(schema, { id: path });
  const { schemas } = z.toJSONSchema(files, {
    target: "draft-2020-12",
    io: "output",
    unrepresentable: "throw",
    uri: (id) => `${CLI_BASE}${id}`,
  });
  return Object.fromEntries(
    Object.entries(schemas).map(([path, schema]) => [path, relativeRefs(CLI_BASE, path, schema)]),
  );
}

/**
 * One file per document kind plus `common.json`, whose `$defs` are the shared
 * definitions of `state/common.ts`; the kinds point there by `$ref`.
 */
function stateSchemas(): Record<string, Record<string, unknown>> {
  const files = z.registry<{ id: string }>();
  for (const [name, schema] of Object.entries(common)) {
    if (schema instanceof z.ZodType) files.add(schema, { id: `${COMMON}#/$defs/${name}` });
  }
  for (const [name, kind] of Object.entries(STATE_KINDS)) {
    files.add(kind.schema, { id: `${name}.json` });
  }
  const { schemas } = z.toJSONSchema(files, {
    target: "draft-2020-12",
    io: "output",
    unrepresentable: "throw",
    uri: (id) => `${STATE_BASE}${id}`,
  });
  const defs: Record<string, unknown> = {};
  const result: Record<string, Record<string, unknown>> = {};
  for (const [id, schema] of Object.entries(schemas)) {
    if (id.startsWith(`${COMMON}#/$defs/`)) {
      const definition = relativeRefs(STATE_BASE, COMMON, schema);
      delete definition.$schema;
      delete definition.$id;
      defs[id.slice(`${COMMON}#/$defs/`.length)] = definition;
    } else {
      result[id] = relativeRefs(STATE_BASE, id, schema);
    }
  }
  result[COMMON] = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${STATE_BASE}${COMMON}`,
    title: "Shared state definitions",
    description: "Ids, references, hashes, timestamps and paths the state documents share.",
    $defs: Object.fromEntries(Object.entries(defs).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  return result;
}

/** Rewrites the absolute `$ref`s zod emits to paths relative to `path`, as the hand-written files use. */
function relativeRefs(
  base: string,
  path: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const text = JSON.stringify(schema, (key, value: unknown) =>
    key === "$ref" && typeof value === "string" && value.startsWith(base)
      ? posix.relative(posix.dirname(path), value.slice(base.length))
      : value,
  );
  return JSON.parse(text) as Record<string, unknown>;
}

/** The keys a reader looks for first lead the file; zod appends `.meta()` fields last. */
const LEADING = ["$schema", "$id", "title", "description"];

function ordered(schema: Record<string, unknown>): Record<string, unknown> {
  const leading = LEADING.filter((key) => key in schema).map((key): [string, unknown] => [
    key,
    schema[key],
  ]);
  const rest = Object.entries(schema).filter(([key]) => !LEADING.includes(key));
  return Object.fromEntries([...leading, ...rest]);
}

async function write(path: string, schema: Record<string, unknown>): Promise<void> {
  const options = await resolveConfig(path);
  const text = await format(JSON.stringify(ordered(schema)), { ...options, filepath: path });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

const root = process.cwd();
await write(join(root, "schema/settings.json"), settingsJsonSchema(settingsRegistry()));
for (const [path, schema] of Object.entries(cliSchemas())) {
  await write(join(root, "schema/cli", path), schema);
}
for (const [path, schema] of Object.entries(stateSchemas())) {
  await write(join(root, "schema/state", path), schema);
}
