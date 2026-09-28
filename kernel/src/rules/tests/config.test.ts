import { describe, expect, it } from "vitest";

import {
  createConfigRegistry,
  mergeLayers,
  promptsModule,
  validateLayers,
} from "../../shared/config/index.ts";
import type { Layer } from "../../shared/config/index.ts";
import { rulesConfig } from "../index.ts";

const registry = createConfigRegistry({
  modules: [...rulesConfig.modules, promptsModule],
  prompts: rulesConfig.prompts,
});

function check(values: Record<string, unknown>) {
  const layers: Layer[] = [{ name: "project", path: "/p.yaml", text: "", values }];
  return validateLayers(registry, layers, mergeLayers(layers));
}

function keysOf(values: Record<string, unknown>): [string, string][] {
  return check(values).problems.map((problem) => [problem.key, problem.rule]);
}

describe("defaults", () => {
  it("resolves languages to an empty list", () => {
    expect(check({}).value).toStrictEqual({ languages: [], prompts: {} });
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

describe("prompt keys", () => {
  it("declares the rule categories and the language pattern with plugin defaults", () => {
    expect(rulesConfig.prompts.map((prompt) => [prompt.key, prompt.defaultFile])).toStrictEqual([
      ["rules/code-quality", "rules/code-quality.md"],
      ["rules/architecture", "rules/architecture.md"],
      ["rules/design-patterns", "rules/design-patterns.md"],
      ["rules/security", "rules/security.md"],
      ["rules/engineering-judgment", "rules/engineering-judgment.md"],
      ["rules/test-quality", "rules/test-quality.md"],
      ["rules/languages/*", "rules/languages/{name}.md"],
    ]);
  });

  it("names rules as the consumer of every key it declares (T23-D30)", () => {
    const consumers = [...rulesConfig.modules, ...rulesConfig.prompts].map((item) => item.consumer);
    expect(new Set(consumers)).toStrictEqual(new Set(["rules"]));
  });
});
