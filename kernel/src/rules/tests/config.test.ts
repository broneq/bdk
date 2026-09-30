import { describe, expect, it } from "vitest";

import {
  createConfigRegistry,
  mergeLayers,
  promptsModule,
  validateLayers,
} from "../../shared/config/index.ts";
import type { Layer } from "../../shared/config/index.ts";
import { readLayers, resolvePrompts } from "../../shared/config/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { rulesConfig } from "../index.ts";

const registry = createConfigRegistry({
  modules: [...rulesConfig.modules, promptsModule],
  prompts: rulesConfig.prompts,
});

function check(values: Record<string, unknown>) {
  const layers: Layer[] = [{ name: "project", path: "/p.yaml", text: "", values }];
  return validateLayers(registry, layers, mergeLayers(layers, registry.appendOnly));
}

function keysOf(values: Record<string, unknown>): [string, string][] {
  return check(values).problems.map((problem) => [problem.key, problem.rule]);
}

describe("defaults", () => {
  it("resolves languages and the rules keys to their defaults", () => {
    expect(check({}).value).toStrictEqual({
      languages: [],
      rules: {
        "warn-above": 100,
        disabled: [],
        audit: { "min-changes": 3 },
        prune: { "uncited-changes": 20 },
      },
      prompts: {},
    });
  });
});

describe("languages", () => {
  it("accepts free-form non-empty names", () => {
    expect(keysOf({ languages: ["typescript", "some-dsl"] })).toStrictEqual([]);
  });

  it.each([
    ["a duplicate", ["go", "go"], "languages"],
    ["an empty name", [""], "languages.0"],
    ["a non-list", "go", "languages"],
  ])("refuses %s", (_, languages, key) => {
    expect(keysOf({ languages })).toStrictEqual([[key, "policy/config-invalid"]]);
  });
});

describe("rules", () => {
  it("accepts the four keys", () => {
    expect(
      keysOf({
        rules: {
          "warn-above": 12,
          disabled: ["BDK-SEC-3", "API-2"],
          audit: { "min-changes": 2 },
          prune: { "uncited-changes": 40 },
        },
      }),
    ).toStrictEqual([]);
  });

  it.each([
    ["warn-above below 1", { "warn-above": 0 }, "rules.warn-above"],
    ["a fractional warn-above", { "warn-above": 2.5 }, "rules.warn-above"],
    ["a disabled id twice", { disabled: ["BDK-SEC-3", "BDK-SEC-3"] }, "rules.disabled"],
    ["a disabled value that is no id", { disabled: ["security"] }, "rules.disabled.0"],
    ["min-changes below 1", { audit: { "min-changes": 0 } }, "rules.audit.min-changes"],
  ])("refuses %s", (_, rules, key) => {
    expect(keysOf({ rules })).toStrictEqual([[key, "policy/config-invalid"]]);
  });

  it.each(["propose-when", "max-learnings-per-change"])(
    "refuses the dropped funnel key rules.%s",
    (key) => {
      expect(keysOf({ rules: { [key]: 1 } })).toStrictEqual([
        [`rules.${key}`, "policy/unknown-config-key"],
      ]);
    },
  );
});

describe("prompt keys", () => {
  it("declares none: rules are files, not prompt values (T31)", () => {
    expect(rulesConfig.prompts).toStrictEqual([]);
  });

  it("names rules as the consumer of every key it declares (T23-D30)", () => {
    const consumers = rulesConfig.modules.map((item) => item.consumer);
    expect(new Set(consumers)).toStrictEqual(new Set(["rules"]));
  });
});

describe("retired rule prompt files", () => {
  const retired = /\.bdk\/rules\/.*rules\.disabled/;

  it("refuses a rules prompt file, naming where rules live now", () => {
    const store = memoryStore({ "/repo/.bdk/prompts/rules/security.md": "- Ours.\n" });
    const { problems } = resolvePrompts({
      store,
      registry,
      layers: readLayers(store, { globalDir: "/home/.config/bdk", projectRoot: "/repo" }),
      globalDir: "/home/.config/bdk",
      projectRoot: "/repo",
      pluginRoot: "/plugin",
    });
    expect(problems.map((problem) => [problem.key, problem.rule])).toStrictEqual([
      ["prompts.rules/security", "policy/unknown-config-key"],
    ]);
    expect(problems[0]?.message).toMatch(retired);
  });

  it("refuses a prompts.files entry for a rule set the same way", () => {
    const problems = check({ prompts: { files: { "rules/languages/go": "go.md" } } }).problems;
    expect(problems.map((problem) => [problem.key, problem.rule])).toStrictEqual([
      ["prompts.files.rules/languages/go", "policy/unknown-config-key"],
    ]);
    expect(problems[0]?.message).toMatch(retired);
  });
});
