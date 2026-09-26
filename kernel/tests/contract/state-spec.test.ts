// `kernel-state`, State JSON Schema (design D-10 of v3-t14-state-schema): the
// field tables of the spec equal the generated `schema/state/` files in field
// names, requiredness and enum values. The prose-only kinds (plan index and
// the design documents) have no table and are covered by the fixture test.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ENTRY_TYPES } from "../../src/shared/store/index.ts";
import { REPO_ROOT } from "../support/run.ts";
import { readStateSchema } from "../support/schemas.ts";
import { backticked, column, requirement, tableRows } from "../support/specs.ts";

const MAIN = join(REPO_ROOT, "openspec/specs/kernel-state/spec.md");
const DELTA = join(REPO_ROOT, "openspec/changes/v3-t14-state-schema/specs/kernel-state/spec.md");
const spec = readFileSync(existsSync(MAIN) ? MAIN : DELTA, "utf8");

/** Requirement title -> the document kind its `Field` table describes. */
const TABLES: Readonly<Record<string, string>> = {
  "Change document": "change",
  "Attempt record": "attempt",
  "Evidence manifest": "evidence",
  "Dispatch package": "dispatch",
  "Report envelope": "report",
  "Plan part and plan index": "plan-part",
  "Rule file frontmatter": "rule",
};

interface Field {
  readonly name: string;
  readonly required: boolean;
  /** Literal values of an enum type; placeholders such as `agent:<role>` are patterns. */
  readonly values: readonly string[];
}

type Json = Record<string, unknown>;

/** Enum values of the first code span listing alternatives (`a \| b`); nested object shapes are skipped. */
function enumValues(text: string): string[] {
  const span = backticked(text).find((code) => code.includes("\\|") && !code.startsWith("{"));
  if (span === undefined) return [];
  return span
    .split("\\|")
    .map((value) => value.trim())
    .filter((value) => !value.includes("<"));
}

function tableFields(text: string): Field[] {
  return tableRows(text, "Field").map((row) => ({
    name: backticked(column(row, "Field"))[0] ?? "",
    required: column(row, "Req.") === "yes",
    values: enumValues(column(row, "Type")),
  }));
}

/** Own fields of each entry type: "`name` (details)", required when the details say "required". */
function ownFields(text: string): Map<string, Field[]> {
  const own = new Map<string, Field[]>();
  for (const row of tableRows(text, "Type")) {
    const type = backticked(column(row, "Type"))[0] ?? "";
    const cell = column(row, "Own fields");
    const fields = [...cell.matchAll(/`([a-z-]+)` \(([^)]*)\)/g)].map(
      ([, name = "", details = ""]) => ({
        name,
        required: /(?:^|, )required(?:,|$)/.test(details),
        values: enumValues(details),
      }),
    );
    own.set(type, fields);
  }
  return own;
}

/** Literal values a JSON Schema accepts for a property: `enum`, `const`, through unions and `$ref`s. */
function literals(schema: Json): string[] {
  if (typeof schema.$ref === "string") {
    const name = /^common\.json#\/\$defs\/(.+)$/.exec(schema.$ref)?.[1];
    const defs = readStateSchema("common").$defs as Record<string, Json>;
    return name === undefined ? [] : literals(defs[name] ?? {});
  }
  const values = [
    ...(Array.isArray(schema.enum) ? schema.enum.map(String) : []),
    ...(typeof schema.const === "string" || typeof schema.const === "number"
      ? [String(schema.const)]
      : []),
  ];
  for (const key of ["anyOf", "oneOf"]) {
    const parts = schema[key];
    if (Array.isArray(parts)) values.push(...parts.flatMap((part) => literals(part as Json)));
  }
  return values;
}

/** Differences between the spec fields and one object schema, each naming the document and field. */
function compare(
  document: string,
  fields: readonly Field[],
  schema: Json,
  exact: boolean,
): string[] {
  const properties = (schema.properties ?? {}) as Record<string, Json>;
  const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  const problems: string[] = [];
  for (const field of fields) {
    const property = properties[field.name];
    if (property === undefined) {
      problems.push(`${document}: ${field.name} is in the spec, not in the schema`);
      continue;
    }
    if (field.required !== required.has(field.name)) {
      problems.push(`${document}: ${field.name} required ${field.required} in the spec`);
    }
    const actual = new Set(literals(property));
    const missing = field.values.filter((value) => !actual.has(value));
    if (missing.length > 0) {
      problems.push(`${document}: ${field.name} lacks ${missing.join(", ")} in the schema`);
    }
    if (field.values.length > 0 && field.name !== "type") {
      const extra = [...actual].filter((value) => !field.values.includes(value));
      if (extra.length > 0)
        problems.push(`${document}: ${field.name} has ${extra.join(", ")} beyond the spec`);
    }
  }
  if (exact) {
    const named = new Set(fields.map((field) => field.name));
    for (const name of Object.keys(properties)) {
      if (!named.has(name)) problems.push(`${document}: ${name} is in the schema, not in the spec`);
    }
  }
  return problems;
}

/** The `type` constant of one entry branch. */
function typeOf(branch: Json): string {
  const properties = branch.properties as Record<string, Json | undefined>;
  return String(properties.type?.const);
}

/** Every drift between the spec text and `schema/state/`. */
function drift(text: string): string[] {
  const problems = Object.entries(TABLES).flatMap(([title, kind]) =>
    compare(kind, tableFields(requirement(text, title)), readStateSchema(kind), true),
  );
  const ledger = requirement(text, "Ledger entry");
  const common = tableFields(ledger);
  const own = ownFields(ledger);
  const branches = readStateSchema("entry").oneOf as Json[];
  const types = branches.map(typeOf);
  if ([...own.keys()].join() !== types.join()) {
    problems.push(
      `entry: types ${[...own.keys()].join(", ")} in the spec, ${types.join(", ")} in the schema`,
    );
  }
  for (const branch of branches) {
    const type = typeOf(branch);
    const fields = [...common.filter((field) => field.name !== "type"), ...(own.get(type) ?? [])];
    problems.push(
      ...compare(
        `entry ${type}`,
        [...fields, { name: "type", required: true, values: [] }],
        branch,
        true,
      ),
    );
  }
  return problems;
}

describe("state spec tables", () => {
  it("equal the generated schemas", () => {
    expect(drift(spec)).toStrictEqual([]);
  });

  it("list the ten entry types", () => {
    expect([...ownFields(requirement(spec, "Ledger entry")).keys()]).toStrictEqual([
      ...ENTRY_TYPES,
    ]);
  });

  it("fail on a renamed field", () => {
    const seeded = spec.replace("| `template-hash`  |", "| `template-digest` |");
    expect(drift(seeded)).toStrictEqual([
      "dispatch: template-digest is in the spec, not in the schema",
      "dispatch: template-hash is in the schema, not in the spec",
    ]);
  });

  it("fail on a dropped enum value", () => {
    const seeded = spec.replace("`ok \\| fail \\| not-run`", "`ok \\| fail`");
    expect(drift(seeded)).toStrictEqual(["attempt: outcome has not-run beyond the spec"]);
  });

  it("fail on a changed requiredness", () => {
    const seeded = spec
      .split("\n")
      .map((line) => (line.startsWith("| `verdict`") ? line.replace("| no   |", "| yes  |") : line))
      .join("\n");
    expect(drift(seeded)).toStrictEqual(["evidence: verdict required true in the spec"]);
  });
});
