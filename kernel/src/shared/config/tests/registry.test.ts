import * as z from "zod";
import { describe, expect, it } from "vitest";

import {
  createConfigRegistry,
  defineConfigModule,
  definePromptKey,
  mergeLayers,
  validateLayers,
} from "../index.ts";
import type { Layer } from "../index.ts";

const tools = defineConfigModule({
  key: "tools",
  consumer: "ctx",
  owner: "T12",
  description: "Commands the project runs.",
  schema: z
    .strictObject({
      test: z
        .array(
          z.strictObject({
            id: z.string(),
            tier: z.enum(["fast", "e2e"]),
            command: z.string().min(1),
          }),
        )
        .default([]),
    })
    .prefault({}),
});

const features = defineConfigModule({
  key: "features",
  consumer: "ctx",
  owner: "T12",
  description: "Feature switches.",
  schema: z.strictObject({ lavish: z.boolean().default(true) }).prefault({}),
});

const security = definePromptKey({
  key: "rules/security",
  consumer: "ctx",
  owner: "T12",
  defaultFile: "rules/security.md",
});

const registry = createConfigRegistry({ modules: [tools, features], prompts: [security] });

function layer(name: Layer["name"], values: Record<string, unknown>): Layer {
  return { name, path: `/${name}.yaml`, text: "", values };
}

function validate(...layers: Layer[]) {
  return validateLayers(registry, layers, mergeLayers(layers));
}

describe("createConfigRegistry", () => {
  it("fails on two modules with the same root key", () => {
    expect(() => createConfigRegistry({ modules: [tools, tools], prompts: [] })).toThrow(
      /tools is declared twice/,
    );
  });

  it("fails on a prompt key that is reserved or holds a dot", () => {
    for (const key of ["dir/x", "files", "rules/a.b"]) {
      const bad = definePromptKey({ key, consumer: "ctx", owner: "T12" });
      expect(() => createConfigRegistry({ modules: [], prompts: [bad] })).toThrow(/prompt key/);
    }
  });

  it("finds a literal and a pattern prompt key", () => {
    const languages = definePromptKey({ key: "rules/languages/*", consumer: "ctx", owner: "T12" });
    const both = createConfigRegistry({ modules: [], prompts: [security, languages] });
    expect(both.promptKey("rules/security")).toBe(security);
    expect(both.promptKey("rules/languages/go")).toBe(languages);
    expect(both.promptKey("rules/languages/go/x")).toBeUndefined();
    expect(both.promptKey("rules/secrity")).toBeUndefined();
  });

  it("lists the declared key paths", () => {
    expect(registry.keys).toStrictEqual(["tools", "tools.test", "features", "features.lavish"]);
  });
});

describe("validateLayers", () => {
  it("resolves defaults for an empty configuration", () => {
    const result = validate();
    expect(result.problems).toStrictEqual([]);
    expect(result.value).toStrictEqual({ tools: { test: [] }, features: { lavish: true } });
  });

  it("reports an unknown key with its full path, layer, file and a hint", () => {
    const result = validate(layer("global", {}), layer("project", { tools: { tests: [] } }));
    expect(result.problems).toStrictEqual([
      {
        rule: "policy/unknown-config-key",
        key: "tools.tests",
        layer: "project",
        path: "/project.yaml",
        message: "unknown key; did you mean tools.test?",
      },
    ]);
  });

  it("reports every leaf of an unknown subtree and gives no hint beyond distance 2", () => {
    const result = validate(layer("local", { zzz: { a: 1, b: [1] } }));
    expect(result.problems.map((problem) => [problem.key, problem.message])).toStrictEqual([
      ["zzz.a", "unknown key"],
      ["zzz.b", "unknown key"],
    ]);
  });

  it("names the owner task of a key declared for a later task", () => {
    const result = validate(layer("project", { policy: { budgets: { "task-redispatch": 5 } } }));
    expect(result.problems).toMatchObject([
      { key: "policy.budgets.task-redispatch", message: "lands with T22" },
    ]);
  });

  it("names every owner below a planned key's ancestor set as a scalar", () => {
    const result = validate(layer("project", { execution: 3 }));
    expect(result.problems).toMatchObject([{ key: "execution", message: "lands with T23" }]);
  });

  it("hints the kebab-case form of a camelCase planned key", () => {
    const result = validate(layer("project", { policy: { budgets: { taskRedispatch: 5 } } }));
    expect(result.problems).toMatchObject([
      {
        key: "policy.budgets.taskRedispatch",
        message: "unknown key; did you mean policy.budgets.task-redispatch?",
      },
    ]);
  });

  it("names the replacement of a removed v2 key", () => {
    const result = validate(
      layer("project", { features: { serena: true }, "test-tools": [{ type: "x" }] }),
    );
    expect(result.problems).toMatchObject([
      {
        rule: "policy/unknown-config-key",
        key: "features.serena",
        message: "removed v2 key: removed with the bundled MCP servers (ADR-0001)",
      },
      { key: "test-tools", message: "removed v2 key: use tools.test" },
    ]);
  });

  it("maps an invalid value back to the layer that set it, addressed by id", () => {
    const result = validate(
      layer("project", { tools: { test: [{ id: "unit", tier: "fast", command: "a" }] } }),
      layer("local", { tools: { test: [{ id: "unit", tier: "slow" }] } }),
    );
    expect(result.problems).toStrictEqual([
      {
        rule: "policy/config-invalid",
        key: "tools.test.unit.tier",
        layer: "local",
        path: "/local.yaml",
        message: 'Invalid option: expected one of "fast"|"e2e"',
      },
    ]);
    expect(result.value).toBeUndefined();
  });

  it("names the highest layer that touched an item for a missing field", () => {
    const result = validate(
      layer("project", { tools: { test: [{ id: "unit", command: "a" }] } }),
      layer("local", { tools: { test: [{ id: "unit", command: "b" }] } }),
    );
    expect(result.problems).toMatchObject([
      { rule: "policy/config-invalid", key: "tools.test.unit.tier", layer: "local" },
    ]);
  });

  it("rejects null for a key that is not nullable", () => {
    const result = validate(layer("local", { features: { lavish: null } }));
    expect(result.problems).toMatchObject([
      { rule: "policy/config-invalid", key: "features.lavish", layer: "local" },
    ]);
  });

  it("reports an unknown field inside an array item", () => {
    const result = validate(
      layer("project", { tools: { test: [{ id: "unit", tier: "fast", command: "a", tyer: 1 }] } }),
    );
    expect(result.problems).toMatchObject([
      { rule: "policy/unknown-config-key", key: "tools.test.unit.tyer", layer: "project" },
    ]);
  });

  it("collects every error instead of stopping at the first", () => {
    const result = validate(
      layer("project", { nope: 1, features: { lavish: "yes" } }),
      layer("local", { tools: { test: [{ id: "a", id2: 1 }] } }),
    );
    expect(result.problems.map((problem) => problem.key)).toStrictEqual([
      "nope",
      "tools.test.a.id2",
      "tools.test.a.tier",
      "tools.test.a.command",
      "features.lavish",
    ]);
  });

  it("carries the merge problems first", () => {
    const result = validate(
      layer("project", {
        tools: {
          test: [
            { id: "a", tier: "fast", command: "x" },
            { id: "a", tier: "fast", command: "x" },
          ],
        },
      }),
    );
    expect(result.problems).toMatchObject([
      {
        rule: "policy/config-invalid",
        key: "tools.test",
        message: "the id a appears twice in one layer",
      },
    ]);
  });
});
