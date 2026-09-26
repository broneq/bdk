import { Ajv2020 } from "ajv/dist/2020.js";
import * as z from "zod";
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../../registrations.ts";
import {
  createConfigRegistry,
  defineConfigModule,
  SETTINGS_SCHEMA_ID,
  settingsJsonSchema,
} from "../index.ts";

const schema = settingsJsonSchema(settingsRegistry());
const validate = new Ajv2020({ strict: false }).compile(schema);

type Node = Record<string, unknown>;

/** Every schema node below `node`, with the JSON pointer that reaches it. */
function nodes(node: unknown, pointer = ""): [string, Node][] {
  if (typeof node !== "object" || node === null) return [];
  if (Array.isArray(node))
    return node.flatMap((item, index) => nodes(item, `${pointer}/${String(index)}`));
  const own: [string, Node][] = [[pointer, node as Node]];
  return own.concat(
    Object.entries(node).flatMap(([key, value]) => nodes(value, `${pointer}/${key}`)),
  );
}

describe("settingsJsonSchema", () => {
  it("is a draft 2020-12 schema with the unversioned id", () => {
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe(SETTINGS_SCHEMA_ID);
    expect(SETTINGS_SCHEMA_ID).toBe(
      "https://raw.githubusercontent.com/broneq/bdk/v3/schema/settings.json",
    );
  });

  it("closes every object that declares properties", () => {
    const open = nodes(schema)
      .filter(([, node]) => node.type === "object" && "properties" in node)
      .filter(([, node]) => node.additionalProperties !== false)
      .map(([pointer]) => pointer);
    expect(open).toStrictEqual([]);
  });

  it.each([
    ["the root", { featurs: {} }],
    ["a module", { tools: { tests: [] } }],
    ["a tool entry", { tools: { test: [{ id: "unit", command: "t", tier: "fast", x: 1 }] } }],
    ["a switch group", { features: { serena: true } }],
    ["a prompt file entry", { prompts: { files: { "rules/security": { path: "a.md", x: 1 } } } }],
  ])("rejects an unknown key in %s", (_, settings) => {
    expect(validate(settings)).toBe(false);
  });

  it("accepts a full valid file", () => {
    const settings = {
      languages: ["go"],
      tools: {
        test: [{ id: "unit", command: "go test ./...", scoped: "go test {files}", tier: "fast" }],
        build: [{ id: "bin", command: "go build ./..." }],
      },
      features: { lavish: false },
      prompts: { dir: "docs/prompts", files: { "rules/security": "sec.md" } },
    };
    expect(validate(settings), JSON.stringify(validate.errors)).toBe(true);
  });

  it("carries the descriptions and defaults of the modules", () => {
    const properties = schema.properties as Record<string, Node>;
    for (const key of ["languages", "tools", "features", "prompts"]) {
      expect(properties[key]?.description, key).toEqual(expect.any(String));
    }
    const lavish = (properties.features?.properties as Record<string, Node>).lavish;
    expect(lavish?.default).toBe(true);
    expect(properties.languages?.default).toStrictEqual([]);
  });

  it("expresses the {files} rule as a pattern", () => {
    expect(
      validate({ tools: { lint: [{ id: "x", command: "c", scoped: "c", tier: "lint" }] } }),
    ).toBe(false);
    const patterns = nodes(schema).map(([, node]) => node.pattern);
    expect(patterns).toContain("\\{files\\}");
  });

  it("throws on a schema JSON Schema cannot express", () => {
    const registry = createConfigRegistry({
      modules: [
        defineConfigModule({
          key: "when",
          consumer: "ctx",
          owner: "T12",
          description: "A date.",
          schema: z.date(),
        }),
      ],
      prompts: [],
    });
    expect(() => settingsJsonSchema(registry)).toThrow();
  });
});
