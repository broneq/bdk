// Writes the generated JSON Schemas (design D-10 of v3-t12-layered-config):
// the settings schema from the config registry and the CLI output schemas
// whose zod exists. `kernel/build.mjs` runs it after bundling the kernel, and
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
import { ctxOutput } from "../src/ctx/schema/ctx.ts";
import { sessionStartOutput } from "../src/hooks/schema/session-start.ts";
import { skillExistsOutput } from "../src/hooks/schema/skill-exists.ts";
import { settingsRegistry } from "../src/registrations.ts";
import { doctorOutput } from "../src/service/schema/doctor.ts";
import { versionOutput } from "../src/service/schema/version.ts";
import { settingsJsonSchema } from "../src/shared/config/index.ts";
import { refusalSchema } from "../src/shared/refusal/index.ts";

const CLI_BASE = "https://raw.githubusercontent.com/broneq/bdk/v3/schema/cli/";

/** Paths under `schema/cli/`; a schema embedding another one gets a `$ref` to its file. */
const CLI_FILES: readonly (readonly [string, z.ZodType])[] = [
  ["common/version.json", versionOutput],
  ["common/refusal.json", refusalSchema],
  ["output/doctor.json", doctorOutput],
  ["output/config-show.json", configShowOutput],
  ["output/config-check.json", configCheckOutput],
  ["output/config-schema.json", configSchemaOutput],
  ["output/config-set.json", configSetOutput],
  ["output/ctx.json", ctxOutput],
  ["output/hooks-session-start.json", sessionStartOutput],
  ["output/hooks-skill-exists.json", skillExistsOutput],
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
    Object.entries(schemas).map(([path, schema]) => [path, relativeRefs(path, schema)]),
  );
}

/** Rewrites the absolute `$ref`s zod emits to paths relative to `path`, as the hand-written files use. */
function relativeRefs(path: string, schema: Record<string, unknown>): Record<string, unknown> {
  const text = JSON.stringify(schema, (key, value: unknown) =>
    key === "$ref" && typeof value === "string" && value.startsWith(CLI_BASE)
      ? posix.relative(posix.dirname(path), value.slice(CLI_BASE.length))
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
