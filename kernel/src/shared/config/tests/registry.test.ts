import * as z from "zod";
import { describe, expect, it } from "vitest";

import {
  appendOnly,
  createConfigRegistry,
  defineConfigModule,
  definePromptKey,
  mergeLayers,
  moduleValue,
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
  return validateLayers(registry, layers, mergeLayers(layers, registry.appendOnly));
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
    const result = validate(layer("project", { rules: { "max-per-package": 5 } }));
    expect(result.problems).toMatchObject([
      { key: "rules.max-per-package", message: "lands with T31" },
    ]);
  });

  it("names every owner below a planned key's ancestor set as a scalar", () => {
    const result = validate(layer("project", { rules: 3 }));
    expect(result.problems).toMatchObject([{ key: "rules", message: "lands with T31" }]);
  });

  it("hints the kebab-case form of a camelCase planned key", () => {
    const result = validate(layer("project", { rules: { proposeWhen: { changes: 5 } } }));
    expect(result.problems).toMatchObject([
      {
        key: "rules.proposeWhen.changes",
        message: "unknown key; did you mean rules.propose-when.changes?",
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

describe("dotted module keys", () => {
  const gates = defineConfigModule({
    key: "policy.gates",
    consumer: "graph",
    owner: "T21",
    description: "Human gates.",
    schema: z.strictObject({ design: z.enum(["manual", "auto"]).default("manual") }).prefault({}),
  });
  const budgets = defineConfigModule({
    key: "policy.budgets",
    consumer: "attempt",
    owner: "T22",
    description: "Loop budgets.",
    schema: z.strictObject({ verifier: z.int().min(0).default(2) }).prefault({}),
  });
  const checkpoint = defineConfigModule({
    key: "policy.checkpoint",
    consumer: "change",
    owner: "T22",
    description: "Checkpoint commits.",
    schema: z.strictObject({ enabled: z.boolean().default(true) }).prefault({}),
  });
  const policy = createConfigRegistry({ modules: [gates, budgets, checkpoint], prompts: [] });
  // A registered module under the root of planned keys (T31 plans `rules.max-per-package`).
  const proposeWhen = defineConfigModule({
    key: "rules.propose-when",
    consumer: "rules",
    owner: "T31",
    description: "Rule proposal thresholds.",
    schema: z.strictObject({ changes: z.int().min(1).default(2) }).prefault({}),
  });
  const rules = createConfigRegistry({ modules: [proposeWhen], prompts: [] });

  function check(...layers: Layer[]) {
    return validateLayers(policy, layers, mergeLayers(layers, policy.appendOnly));
  }

  it("composes the modules of one root into one strict object", () => {
    expect(policy.keys).toStrictEqual([
      "policy",
      "policy.gates",
      "policy.gates.design",
      "policy.budgets",
      "policy.budgets.verifier",
      "policy.checkpoint",
      "policy.checkpoint.enabled",
    ]);
    const result = check(layer("project", { policy: { budgets: { verifier: 3 } } }));
    expect(result.problems).toStrictEqual([]);
    expect(result.value).toStrictEqual({
      policy: {
        gates: { design: "manual" },
        budgets: { verifier: 3 },
        checkpoint: { enabled: true },
      },
    });
  });

  it("fails on a module whose key is a prefix of another's", () => {
    const whole = defineConfigModule({ ...gates, key: "policy" });
    expect(() => createConfigRegistry({ modules: [whole, gates], prompts: [] })).toThrow(
      /policy overlaps policy.gates/,
    );
    expect(() => createConfigRegistry({ modules: [gates, whole], prompts: [] })).toThrow(
      /policy.gates overlaps policy/,
    );
  });

  it("fails on two modules with the same dotted key", () => {
    expect(() => createConfigRegistry({ modules: [gates, gates], prompts: [] })).toThrow(
      /policy.gates is declared twice/,
    );
  });

  it("answers an unknown key under the composed root with a hint", () => {
    const result = check(layer("project", { policy: { budgets: { verfier: 3 } } }));
    expect(result.problems).toMatchObject([
      {
        rule: "policy/unknown-config-key",
        key: "policy.budgets.verfier",
        message: "unknown key; did you mean policy.budgets.verifier?",
      },
    ]);
  });

  it("names the owner of a planned key inside a registered subtree", () => {
    const layers = [layer("project", { rules: { "max-per-package": 5 } })];
    const result = validateLayers(rules, layers, mergeLayers(layers, rules.appendOnly));
    expect(result.problems).toMatchObject([
      { key: "rules.max-per-package", message: "lands with T31" },
    ]);
  });

  it("names the owner of a planned subtree next to registered ones", () => {
    const layers = [layer("project", { rules: { "max-per-package": 5, "propose-when": {} } })];
    const result = validateLayers(rules, layers, mergeLayers(layers, rules.appendOnly));
    expect(result.problems).toMatchObject([
      { key: "rules.max-per-package", message: "lands with T31" },
    ]);
  });

  it("reads a module's value by its dotted key", () => {
    const result = check(layer("project", { policy: { gates: { design: "auto" } } }));
    expect(moduleValue(gates, result.value ?? {})).toStrictEqual({ design: "auto" });
    expect(moduleValue(budgets, result.value ?? {})).toStrictEqual({ verifier: 2 });
  });
});

describe("default items of an id array", () => {
  const item = z.strictObject({ id: z.string(), description: z.string().min(1) });
  const verifier = defineConfigModule({
    key: "policy.verifier",
    consumer: "log",
    owner: "T23",
    description: "Verifier categories.",
    schema: z
      .strictObject({
        "blocking-categories": z.array(item).default([
          { id: "architecture", description: "Invalid architecture." },
          { id: "security", description: "A security risk." },
        ]),
      })
      .prefault({}),
  });
  const registry = createConfigRegistry({ modules: [verifier], prompts: [] });

  function check(...layers: Layer[]) {
    return validateLayers(registry, layers, mergeLayers(layers, registry.appendOnly));
  }

  const ids = (value: Record<string, unknown> | undefined) =>
    (moduleValue(verifier, value ?? {})["blocking-categories"] as { id: string }[]).map(
      (entry) => entry.id,
    );

  it("keeps the defaults when no layer sets the array", () => {
    expect(ids(check().value)).toStrictEqual(["architecture", "security"]);
  });

  it("appends a layer's new item after the defaults", () => {
    const result = check(
      layer("project", {
        policy: {
          verifier: { "blocking-categories": [{ id: "accessibility", description: "WCAG AA." }] },
        },
      }),
    );
    expect(ids(result.value)).toStrictEqual(["architecture", "security", "accessibility"]);
  });

  it("merges a layer's item into the default with the same id", () => {
    const result = check(
      layer("project", {
        policy: { verifier: { "blocking-categories": [{ id: "security", description: "Ours." }] } },
      }),
    );
    expect(moduleValue(verifier, result.value ?? {})["blocking-categories"]).toStrictEqual([
      { id: "architecture", description: "Invalid architecture." },
      { id: "security", description: "Ours." },
    ]);
  });

  it("names an invalid layer item by its id, not by its index among the defaults", () => {
    const result = check(
      layer("project", {
        policy: { verifier: { "blocking-categories": [{ id: "accessibility", description: "" }] } },
      }),
    );
    expect(result.problems).toMatchObject([
      {
        rule: "policy/config-invalid",
        key: "policy.verifier.blocking-categories.accessibility.description",
        layer: "project",
      },
    ]);
  });
});

describe("append-only arrays", () => {
  const evidence = defineConfigModule({
    key: "policy.evidence",
    consumer: "evidence",
    owner: "T23",
    description: "File classes.",
    schema: z
      .strictObject({
        "non-executable": appendOnly(z.array(z.string().min(1))).default(["**/*.md", "docs/**"]),
      })
      .prefault({}),
  });
  const withEvidence = createConfigRegistry({ modules: [evidence], prompts: [] });
  const check = (...layers: Layer[]) =>
    validateLayers(withEvidence, layers, mergeLayers(layers, withEvidence.appendOnly));

  it("declares the key append-only", () => {
    expect([...withEvidence.appendOnly]).toStrictEqual(["policy.evidence.non-executable"]);
  });

  it("keeps the defaults when no layer sets the key", () => {
    expect(check().value).toStrictEqual({
      policy: { evidence: { "non-executable": ["**/*.md", "docs/**"] } },
    });
  });

  it("appends a layer's items after the defaults, each once", () => {
    const resolved = check(
      layer("project", { policy: { evidence: { "non-executable": ["site/**", "**/*.md"] } } }),
      layer("local", { policy: { evidence: { "non-executable": ["site/**", "tmp/**"] } } }),
    );
    expect(resolved.problems).toStrictEqual([]);
    expect(resolved.value).toStrictEqual({
      policy: { evidence: { "non-executable": ["**/*.md", "docs/**", "site/**", "tmp/**"] } },
    });
  });

  it("keeps the defaults when a layer sets an empty list", () => {
    const resolved = check(layer("project", { policy: { evidence: { "non-executable": [] } } }));
    expect(resolved.value).toStrictEqual({
      policy: { evidence: { "non-executable": ["**/*.md", "docs/**"] } },
    });
  });

  it("still validates the items a layer appends", () => {
    const resolved = check(layer("project", { policy: { evidence: { "non-executable": [""] } } }));
    expect(resolved.problems.map((problem) => [problem.rule, problem.layer])).toStrictEqual([
      ["policy/config-invalid", "project"],
    ]);
  });
});
