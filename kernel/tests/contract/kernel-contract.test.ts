// The kernel against its contract (design D-8): every record answers, the
// rule catalogue in code equals the spec's, and the committed JSON Schemas
// accept their examples. Files generated from zod (kernel/scripts/
// export-schemas.ts) need no zod comparison: CI's `git diff --exit-code
// schema/` keeps them equal to their source; `list-page.json` stays
// hand-written and is compared below.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import commands from "../../../schema/cli/commands.json" with { type: "json" };
import { registrations, settingsRegistry } from "../../src/registrations.ts";
import { listPage, listPageSchema } from "../../src/shared/output/index.ts";
import { refusalSchema, RULES } from "../../src/shared/refusal/index.ts";
import { createRegistry, loadIndex } from "../../src/shared/registry/index.ts";
import { memoryStore } from "../../src/shared/store/index.ts";
import { REPO_ROOT } from "../support/run.ts";
import { readSchema, requiredOf, SCHEMA_FILES, validatorFor } from "../support/schemas.ts";
import { backticked, requirement, tableFirstColumn } from "../support/specs.ts";

const index = loadIndex(commands);
const registry = createRegistry(
  index,
  registrations({
    store: memoryStore(),
    pluginRoot: "/",
    contract: index.contract,
    settings: settingsRegistry(),
  }),
);

function examplesOf(file: string): unknown[] {
  const examples = readSchema(file).examples;
  return Array.isArray(examples) ? (examples as unknown[]) : [];
}

/** A copy of `value` without its first required field, which every schema must reject. */
function broken(file: string, value: unknown): unknown {
  const [field] = requiredOf(file);
  if (field === undefined) throw new Error(`${file} requires no field, so nothing can break it`);
  const copy = { ...(value as Record<string, unknown>) };
  Reflect.deleteProperty(copy, field);
  return copy;
}

describe("registry", () => {
  it("answers every record with its handler or the stub", () => {
    for (const record of index.commands) {
      expect(["handler", "stub"]).toContain(registry.implementation(record.id));
    }
  });

  it.each([
    ["T11", ["doctor", "version"]],
    ["T12", ["config-check", "config-schema", "config-set", "config-show"]],
  ])("registers a handler for every record %s owns", (owner, ids) => {
    const owned = index.commands.filter((record) => record.owner === owner);
    expect(owned.map((record) => record.id).sort()).toStrictEqual(ids);
    for (const record of owned) expect(registry.implementation(record.id)).toBe("handler");
  });
});

describe("rule catalogue", () => {
  it("equals the catalogue table of kernel-cli, Exit codes and the error object", () => {
    const spec = readFileSync(join(REPO_ROOT, "openspec/specs/kernel-cli/spec.md"), "utf8");
    const table = tableFirstColumn(requirement(spec, "Exit codes and the error object"), "Rule");
    const catalogue = table
      .flatMap((row) => backticked(row[0] ?? ""))
      .filter((cell) => cell.includes("/"));
    expect([...RULES].sort()).toStrictEqual([...new Set(catalogue)].sort());
  });
});

describe.each(SCHEMA_FILES)("%s", (file) => {
  const validate = validatorFor(file);

  it("validates each of its examples and rejects each without a required field", () => {
    for (const example of examplesOf(file)) {
      expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(broken(file, example))).toBe(false);
    }
  });
});

describe("list page", () => {
  const validate = validatorFor("common/list-page.json");
  const schema = listPageSchema(refusalSchema.shape.rule);

  it.each([
    ["a short page", listPage(["kernel/not-implemented"])],
    [
      "a truncated page with --for",
      listPage(
        Array.from({ length: 150 }, () => "input/not-found"),
        { for: "02-3" },
      ),
    ],
  ])("agrees with the JSON Schema on %s", (_, page) => {
    expect(validate(page), JSON.stringify(validate.errors)).toBe(true);
    expect(schema.safeParse(page).error).toBeUndefined();
    const withoutTotal: Record<string, unknown> = { ...page };
    Reflect.deleteProperty(withoutTotal, "total");
    expect(validate(withoutTotal)).toBe(false);
    expect(schema.safeParse(withoutTotal).success).toBe(false);
  });
});
