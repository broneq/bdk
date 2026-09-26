import { describe, expect, it } from "vitest";

import {
  createConfigRegistry,
  mergeLayers,
  promptsModule,
  resolveConfig,
  validateLayers,
} from "../../shared/config/index.ts";
import type { Layer } from "../../shared/config/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { ctxConfig } from "../index.ts";

const registry = createConfigRegistry({
  modules: [...ctxConfig.modules, promptsModule],
  prompts: ctxConfig.prompts,
});

function check(values: Record<string, unknown>) {
  const layers: Layer[] = [{ name: "project", path: "/p.yaml", text: "", values }];
  return validateLayers(registry, layers, mergeLayers(layers));
}

function keysOf(values: Record<string, unknown>): [string, string][] {
  return check(values).problems.map((problem) => [problem.key, problem.rule]);
}

const unit = { id: "unit", tier: "fast", command: "pnpm test:unit" };

describe("defaults", () => {
  it("resolves every T12 key of an empty configuration", () => {
    expect(check({}).value).toStrictEqual({
      languages: [],
      tools: { test: [], lint: [], build: [] },
      features: { lavish: true },
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

describe("tool entries", () => {
  it("accepts every field of a test entry, including when", () => {
    const entry = {
      ...unit,
      scoped: "pnpm vitest run {files}",
      related: "pnpm vitest related --run {files}",
      failed: "pnpm vitest --changed",
      incremental: "pnpm vitest --incremental",
      when: "only for changes under kernel/",
    };
    const result = check({ tools: { test: [entry] } });
    expect(result.problems).toStrictEqual([]);
    expect(result.value).toMatchObject({ tools: { test: [entry] } });
  });

  it.each([
    ["test", { id: "unit", command: "x" }, "tools.test.unit.tier"],
    ["test", { ...unit, tier: "lint" }, "tools.test.unit.tier"],
    ["lint", { id: "es", tier: "fast", command: "x" }, "tools.lint.es.tier"],
    ["test", { id: "unit", tier: "fast" }, "tools.test.unit.command"],
    ["test", { ...unit, command: "" }, "tools.test.unit.command"],
    ["test", { ...unit, scoped: "vitest" }, "tools.test.unit.scoped"],
    ["lint", { id: "es", tier: "lint", command: "x", related: "eslint" }, "tools.lint.es.related"],
    ["test", { ...unit, when: "" }, "tools.test.unit.when"],
  ])("refuses a bad %s entry at %s", (kind, entry, key) => {
    expect(keysOf({ tools: { [kind]: [entry] } })).toStrictEqual([[key, "policy/config-invalid"]]);
  });

  it("accepts every lint tier and a build entry without tier", () => {
    const lint = ["lint", "format", "typecheck"].map((tier) => ({ id: tier, tier, command: "x" }));
    expect(keysOf({ tools: { lint, build: [{ id: "b", command: "make" }] } })).toStrictEqual([]);
  });

  it("refuses an id that is not a kebab-case path segment", () => {
    expect(keysOf({ tools: { test: [{ ...unit, id: "unit.fast" }] } })).toStrictEqual([
      ["tools.test.unit.fast.id", "policy/config-invalid"],
    ]);
  });

  it("refuses a tier on a build entry as an unknown field", () => {
    expect(keysOf({ tools: { build: [{ id: "b", tier: "fast", command: "x" }] } })).toStrictEqual([
      ["tools.build.b.tier", "policy/unknown-config-key"],
    ]);
  });

  it("refuses an unknown field", () => {
    expect(keysOf({ tools: { test: [{ ...unit, type: "vitest" }] } })).toStrictEqual([
      ["tools.test.unit.type", "policy/unknown-config-key"],
    ]);
  });
});

describe("features", () => {
  it("refuses a non-boolean lavish", () => {
    expect(keysOf({ features: { lavish: "yes" } })).toStrictEqual([
      ["features.lavish", "policy/config-invalid"],
    ]);
  });
});

describe("prompts", () => {
  it("accepts a directory and both file forms for a registered key", () => {
    const prompts = {
      dir: "docs/bdk-prompts",
      files: {
        "rules/security": "docs/security.md",
        "rules/languages/go": { path: "go.md", mode: "replace", applies: ["**/*.go"] },
      },
    };
    expect(keysOf({ prompts })).toStrictEqual([]);
  });

  it("refuses an unregistered prompt key and a bad mode", () => {
    const prompts = {
      files: { "rules/secrity": "a.md", "rules/security": { path: "a.md", mode: "merge" } },
    };
    expect(keysOf({ prompts })).toStrictEqual([
      ["prompts.files.rules/secrity", "policy/unknown-config-key"],
      ["prompts.files.rules/security", "policy/config-invalid"],
    ]);
  });

  it.each([
    ["an empty glob", [""]],
    ["an absolute glob", ["/etc/*"]],
    ["an empty segment", ["a//b"]],
  ])("refuses %s in applies", (_, applies) => {
    const prompts = { files: { "rules/security": { path: "a.md", applies } } };
    expect(keysOf({ prompts })).toMatchObject([
      ["prompts.files.rules/security.applies.0", "policy/config-invalid"],
    ]);
  });
});

describe("prompt keys", () => {
  it("declares the rule categories and the language pattern with plugin defaults", () => {
    expect(ctxConfig.prompts.map((prompt) => [prompt.key, prompt.defaultFile])).toStrictEqual([
      ["rules/code-quality", "rules/code-quality.md"],
      ["rules/architecture", "rules/architecture.md"],
      ["rules/design-patterns", "rules/design-patterns.md"],
      ["rules/security", "rules/security.md"],
      ["rules/engineering-judgment", "rules/engineering-judgment.md"],
      ["rules/test-quality", "rules/test-quality.md"],
      ["rules/languages/*", "rules/languages/{name}.md"],
      ["fragments/decision/lavish", "fragments/decision/lavish.md"],
      ["fragments/decision/ask-user", "fragments/decision/ask-user.md"],
    ]);
    expect(new Set(ctxConfig.prompts.map((prompt) => prompt.consumer))).toStrictEqual(
      new Set(["ctx"]),
    );
  });

  it("resolves a fragment to its plugin default, and a project file with mode replace wins", () => {
    const files = {
      "/plugin/fragments/decision/ask-user.md": "Ask in the terminal.\n",
      "/plugin/fragments/decision/lavish.md": "Ask in Lavish.\n",
    };
    const resolveWith = (extra: Record<string, string>) =>
      resolveConfig({
        store: memoryStore({ ...files, ...extra }),
        registry,
        globalDir: "/home/dev/.config/bdk",
        projectRoot: "/repo",
        pluginRoot: "/plugin",
      }).prompts.values.get("fragments/decision/ask-user");
    expect(resolveWith({})?.files.map((file) => file.path)).toStrictEqual([
      "/plugin/fragments/decision/ask-user.md",
    ]);
    const replaced = resolveWith({
      "/repo/.bdk/prompts/fragments/decision/ask-user.md": "---\nmode: replace\n---\nOurs.\n",
    });
    expect(replaced?.mode).toBe("replace");
    expect(replaced?.files.map((file) => file.path)).toStrictEqual([
      "/repo/.bdk/prompts/fragments/decision/ask-user.md",
    ]);
  });
});
