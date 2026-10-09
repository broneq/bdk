import { describe, expect, it } from "vitest";

import { knownUnder, resolveKey } from "../domain/keys.ts";
import { duplicateIds, flatten, keyOfPath, mergeLayers, withOrigins } from "../domain/merge.ts";
import type { Layer } from "../domain/merge.ts";
import { DEFAULTS } from "../domain/settings.ts";
import { DEFAULT_LAYER, validate } from "../domain/validate.ts";
import type { Suggest } from "../domain/validate.ts";

// Pure rules of spec `bdk-cli/config`: defaults, merge, origins, keys and validation.

const suggest: Suggest = (name, names) =>
  names.find((candidate) => candidate.startsWith(name) || name.startsWith(candidate));

const layer = (name: Layer["name"], data: Record<string, unknown>): Layer => ({
  name,
  file: `/p/${name}.yaml`,
  data,
});

describe("defaults", () => {
  it("holds every key of the spec table", () => {
    expect(DEFAULTS).toEqual({
      tools: { test: [], lint: [], build: [], e2e: [] },
      languages: [],
      rules: {},
      models: {},
      policy: {
        gates: { design: "manual", review: "manual" },
        questions: "stop",
        budgets: { "part-attempts": 3, "review-rounds": 3, verifier: 3 },
        escalation: { model: "opus" },
      },
      plan: { part: { "max-tasks": 5, "max-files": 10, "max-bytes": 8192 } },
      steps: {},
      execution: { lead: "background", "max-parallel": 10 },
      hooks: { "subagent-git": false },
    });
  });
});

describe("merge", () => {
  it("merges id arrays item by item and appends new ids in order", () => {
    const merged = mergeLayers([
      layer("project", {
        tools: {
          test: [
            { id: "unit", command: "pnpm test" },
            { id: "e2e", command: "pnpm e2e" },
          ],
        },
      }),
      layer("local", {
        tools: {
          test: [
            { id: "unit", when: ["part"] },
            { id: "x", command: "x" },
          ],
        },
      }),
    ]);
    expect(merged).toEqual({
      tools: {
        test: [
          { id: "unit", command: "pnpm test", when: ["part"] },
          { id: "e2e", command: "pnpm e2e" },
          { id: "x", command: "x" },
        ],
      },
    });
  });

  it("replaces scalar arrays and scalars, and merges mappings deeply", () => {
    const merged = mergeLayers([
      layer("project", { languages: ["typescript", "react"], models: { a: "opus" } }),
      layer("local", { languages: ["typescript"], models: { b: "haiku" } }),
    ]);
    expect(merged).toEqual({ languages: ["typescript"], models: { a: "opus", b: "haiku" } });
  });

  it("lets a higher scalar replace a lower mapping", () => {
    expect(
      mergeLayers([layer("global", { plan: { part: {} } }), layer("local", { plan: 5 })]),
    ).toEqual({ plan: 5 });
  });
});

describe("flatten and origins", () => {
  it("walks mappings and id arrays, keeping other arrays and empty values whole", () => {
    expect(
      flatten({
        a: { b: 1, c: [1, 2] },
        d: {},
        t: [{ id: "u", command: "x" }, { id: "v" }],
        e: [],
      }),
    ).toEqual([
      { key: "a.b", value: 1 },
      { key: "a.c", value: [1, 2] },
      { key: "d", value: {} },
      { key: "t.u.command", value: "x" },
      { key: "t.v", value: {} },
      { key: "e", value: [] },
    ]);
  });

  it("names the highest layer that set each leaf, default otherwise", () => {
    const layers = [
      DEFAULT_LAYER,
      layer("project", { languages: ["typescript"], execution: { lead: "foreground" } }),
      layer("local", { execution: { lead: "background" } }),
    ];
    const origins = Object.fromEntries(
      withOrigins(mergeLayers(layers), layers).map((leaf) => [leaf.key, leaf.origin]),
    );
    expect(origins).toMatchObject({
      languages: "project",
      "execution.lead": "local",
      "plan.part.max-tasks": "default",
    });
  });
});

describe("keys", () => {
  it("turns an index into an id array into the item id", () => {
    const value = { tools: { test: [{ id: "unit" }, { id: "Bad id" }] } };
    expect(keyOfPath(value, ["tools", "test", 0, "command"])).toBe("tools.test.unit.command");
    expect(keyOfPath(value, ["tools", "test", 1, "id"])).toBe("tools.test[1].id");
    expect(keyOfPath({ languages: ["A"] }, ["languages", 0])).toBe("languages[0]");
  });

  it("resolves keys through mappings, records and id arrays", () => {
    expect(resolveKey("tools.test.unit.when")).toEqual({
      ok: true,
      steps: [
        { kind: "key", name: "tools" },
        { kind: "key", name: "test" },
        { kind: "id", id: "unit" },
        { kind: "key", name: "when" },
      ],
    });
    expect(resolveKey("models.implementer.effort").ok).toBe(true);
    expect(resolveKey("tools.e2e.web.env.PORT").ok).toBe(true);
    expect(resolveKey("tools.e2e.web.browser").ok).toBe(true);
    expect(resolveKey("steps.execute.review.enabled").ok).toBe(true);
  });

  it("fails at the first segment naming nothing, with the names known there", () => {
    expect(resolveKey("plan.part.max-task")).toEqual({
      ok: false,
      at: "plan.part",
      segment: "max-task",
      known: ["max-tasks", "max-files", "max-bytes"],
    });
    expect(resolveKey("models.Bad")).toMatchObject({
      ok: false,
      known: expect.arrayContaining(["implementer", "planner"]) as unknown,
    });
    expect(resolveKey("languages.x")).toMatchObject({ ok: false, at: "languages" });
    expect(knownUnder("")).toContain("tools");
    expect(knownUnder("tools.test.unit")).toEqual(["command", "when", "timeout", "paths"]);
  });
});

describe("duplicate ids", () => {
  it("names the key and the id", () => {
    expect(
      duplicateIds({ tools: { lint: [{ id: "a" }, { id: "b" }, { id: "a" }, { id: "a" }] } }),
    ).toEqual([{ key: "tools.lint", id: "a" }]);
  });
});

describe("validate", () => {
  it("resolves a valid configuration", () => {
    const result = validate([layer("project", { languages: ["typescript"] })], suggest);
    expect(result.problems).toEqual([]);
    expect(result.settings?.languages).toEqual(["typescript"]);
  });

  it("resolves the defaults when no layer file exists", () => {
    expect(validate([], suggest)).toEqual({ problems: [], settings: DEFAULTS });
  });

  it("names the layer, the full key and a suggestion for an unknown key", () => {
    expect(
      validate([layer("project", { plan: { part: { "max-task": 4 } } })], suggest).problems,
    ).toEqual([
      {
        layer: "project",
        file: "/p/project.yaml",
        key: "plan.part.max-task",
        message: "unknown key; did you mean plan.part.max-tasks?",
      },
    ]);
  });

  it("reports an invalid value that a higher layer overrides", () => {
    const { problems } = validate(
      [
        layer("global", { execution: { lead: "sideways" } }),
        layer("local", { execution: { lead: "foreground" } }),
      ],
      suggest,
    );
    expect(problems).toEqual([
      expect.objectContaining({ layer: "global", key: "execution.lead" }) as unknown,
    ]);
  });

  it("checks a partial item only on top of the layers below it", () => {
    const project = layer("project", { tools: { test: [{ id: "unit", command: "pnpm test" }] } });
    const local = layer("local", { tools: { test: [{ id: "unit", when: ["part"] }] } });
    expect(validate([project, local], suggest).problems).toEqual([]);
    expect(validate([local], suggest).problems).toEqual([
      {
        layer: "local",
        file: "/p/local.yaml",
        key: "tools.test.unit.command",
        message: "required, missing",
      },
    ]);
  });

  it("reports a partial item of a lower layer only when no higher layer completes it", () => {
    const global = layer("global", { tools: { test: [{ id: "unit", when: ["part"] }] } });
    const project = layer("project", { tools: { test: [{ id: "unit", command: "pnpm test" }] } });
    expect(validate([global, project], suggest).problems).toEqual([]);
  });

  it("reports duplicate ids, invalid keys and wrong types", () => {
    const { problems } = validate(
      [
        layer("project", {
          tools: {
            lint: [
              { id: "a", command: "x" },
              { id: "a", command: "y" },
            ],
          },
          models: { Bad: { model: "opus" } },
          plan: { part: { "max-files": "many" } },
        }),
      ],
      suggest,
    );
    expect(problems.map((problem) => [problem.key, problem.message.split(":")[0]])).toEqual([
      ["tools.lint", "duplicate id a"],
      ["models.Bad", "unknown key"],
      ["plan.part.max-files", "Invalid input"],
    ]);
  });

  it("accepts a check timeout of at least one second and reports a smaller one", () => {
    const tools = (timeout: unknown) =>
      layer("project", { tools: { build: [{ id: "tsc", command: "tsc", timeout }] } });
    expect(validate([tools(30)], suggest).settings?.tools.build).toEqual([
      { id: "tsc", command: "tsc", timeout: 30 },
    ]);
    expect(validate([tools(0)], suggest).problems).toEqual([
      expect.objectContaining({
        key: "tools.build.tsc.timeout",
        message: expect.stringContaining(">=1") as unknown,
      }) as unknown,
    ]);
    expect(validate([tools(86_401)], suggest).problems.map((problem) => problem.key)).toEqual([
      "tools.build.tsc.timeout",
    ]);
    expect(validate([tools(1.5)], suggest).problems.map((problem) => problem.key)).toEqual([
      "tools.build.tsc.timeout",
    ]);
  });

  it("accepts check paths as a list of globs and reports an empty list or glob", () => {
    const tools = (paths: unknown) =>
      layer("project", { tools: { test: [{ id: "api", command: "pytest", paths }] } });
    expect(validate([tools(["api/**", "**/*.py"])], suggest).settings?.tools.test).toEqual([
      { id: "api", command: "pytest", paths: ["api/**", "**/*.py"] },
    ]);
    expect(validate([tools([])], suggest).problems).toEqual([
      expect.objectContaining({
        key: "tools.test.api.paths",
        message: expect.stringContaining("at least one glob") as unknown,
      }) as unknown,
    ]);
    expect(validate([tools([""])], suggest).problems.map((problem) => problem.key)).toEqual([
      "tools.test.api.paths[0]",
    ]);
    expect(validate([tools("api/**")], suggest).problems.map((problem) => problem.key)).toEqual([
      "tools.test.api.paths",
    ]);
  });

  it("accepts the check points of an item and reports a repeated, unknown or empty one", () => {
    const tools = (when: unknown) =>
      layer("project", { tools: { test: [{ id: "unit", command: "vitest", when }] } });
    expect(validate([tools(["wave", "review"])], suggest).settings?.tools.test).toEqual([
      { id: "unit", command: "vitest", when: ["wave", "review"] },
    ]);
    expect(validate([tools(["part", "part"])], suggest).problems).toEqual([
      expect.objectContaining({
        key: "tools.test.unit.when",
        message: expect.stringContaining("must not repeat a point") as unknown,
      }) as unknown,
    ]);
    expect(validate([tools(["merge"])], suggest).problems).toEqual([
      expect.objectContaining({
        key: "tools.test.unit.when[0]",
        message: expect.stringMatching(/part.*wave.*review/) as unknown,
      }) as unknown,
    ]);
    expect(validate([tools([])], suggest).problems.map((problem) => problem.key)).toEqual([
      "tools.test.unit.when",
    ]);
  });

  it("reports the removed scoped field with its rewrite", () => {
    const tools = layer("project", {
      tools: { lint: [{ id: "eslint", command: "pnpm lint", scoped: "pnpm eslint {files}" }] },
    });
    expect(validate([tools], suggest).problems).toEqual([
      {
        layer: "project",
        file: "/p/project.yaml",
        key: "tools.lint.eslint.scoped",
        message:
          "scoped was removed: put {files} into the command of a second item that runs at part (when: [part])",
      },
    ]);
  });

  it("defaults the verifier budget to 3 and reports a budget below 1", () => {
    const budget = (verifier: unknown) => layer("project", { policy: { budgets: { verifier } } });
    expect(validate([], suggest).settings?.policy.budgets.verifier).toBe(3);
    expect(validate([budget(2)], suggest).settings?.policy.budgets.verifier).toBe(2);
    expect(validate([budget(0)], suggest).problems.map((problem) => problem.key)).toEqual([
      "policy.budgets.verifier",
    ]);
  });

  it("defaults the wave size limit to 10 and reports a limit below 1", () => {
    const limit = (value: unknown) => layer("local", { execution: { "max-parallel": value } });
    expect(validate([], suggest).settings?.execution["max-parallel"]).toBe(10);
    expect(validate([limit(4)], suggest).settings?.execution["max-parallel"]).toBe(4);
    expect(validate([limit(0)], suggest).problems.map((problem) => problem.key)).toEqual([
      "execution.max-parallel",
    ]);
  });

  it("accepts the two browser tools of an e2e item and reports another", () => {
    const web = (browser: unknown) =>
      layer("project", {
        tools: {
          e2e: [
            {
              id: "web",
              start: "pnpm dev",
              ready: "http://localhost:5173",
              driver: "browser",
              browser,
            },
          ],
        },
      });
    for (const browser of ["playwright", "chrome-devtools-mcp"]) {
      expect(validate([web(browser)], suggest).settings?.tools.e2e[0]?.browser).toBe(browser);
    }
    expect(validate([web(undefined)], suggest).settings?.tools.e2e[0]?.browser).toBeUndefined();
    const { problems } = validate([web("chrome-devtools-axi")], suggest);
    expect(problems).toEqual([
      expect.objectContaining({ key: "tools.e2e.web.browser" }) as unknown,
    ]);
    expect(problems[0]?.message).toContain("playwright");
    expect(problems[0]?.message).toContain("chrome-devtools-mcp");
  });

  it("attributes a problem of a key no layer sets to the layer above it", () => {
    const { problems } = validate(
      [layer("project", { tools: { e2e: [{ id: "web", start: "x" }] } })],
      suggest,
    );
    expect(problems.map((problem) => [problem.layer, problem.key])).toEqual([
      ["project", "tools.e2e.web.ready"],
      ["project", "tools.e2e.web.driver"],
    ]);
  });

  it("accepts project rules and pack adjustments keyed by rule id", () => {
    const { problems, settings } = validate(
      [
        layer("project", {
          rules: {
            "API-1": { paths: ["src/api/**"], text: "Parse the body." },
            "GATEWAY-1": { stages: ["design"], file: "docs/gateway.md" },
            "PYD-1": {
              kind: "knowledge",
              source: "https://docs.pydantic.dev",
              verified: "2026-10-01",
              text: "Use field_validator.",
            },
            "BDK-DP-2": { enabled: false },
            "BDK-REACT-10": { paths: ["apps/web/**/*.tsx"], stages: ["review"] },
          },
        }),
      ],
      suggest,
    );
    expect(problems).toEqual([]);
    expect(settings?.rules["BDK-DP-2"]).toEqual({ enabled: false });
    expect(settings?.rules["API-1"]).toEqual({ paths: ["src/api/**"], text: "Parse the body." });
  });

  it("completes a project rule across layers and reports a rule no layer completes", () => {
    const project = layer("project", { rules: { "API-1": { text: "Parse the body." } } });
    const local = layer("local", { rules: { "API-1": { enabled: false } } });
    expect(validate([project, local], suggest).problems).toEqual([]);
    const global = layer("global", { rules: { "API-1": { enabled: false } } });
    expect(validate([global, project], suggest).problems).toEqual([]);
    expect(validate([local], suggest).problems).toEqual([
      {
        layer: "local",
        file: "/p/local.yaml",
        key: "rules.API-1",
        message: "a project rule holds exactly one of text and file",
      },
    ]);
  });

  it("reports a rule with both text and file", () => {
    const { problems } = validate(
      [layer("project", { rules: { "API-1": { text: "x", file: "docs/api.md" } } })],
      suggest,
    );
    expect(problems).toEqual([
      expect.objectContaining({
        key: "rules.API-1",
        message: "a project rule holds exactly one of text and file",
      }) as unknown,
    ]);
  });

  it("reports a pack rule entry with a field other than enabled, paths and stages", () => {
    const { problems } = validate(
      [layer("project", { rules: { "BDK-CQ-1": { text: "Short names are fine." } } })],
      suggest,
    );
    expect(problems).toEqual([
      expect.objectContaining({
        key: "rules.BDK-CQ-1.text",
        message: "a BDK- entry takes only enabled, paths and stages",
      }) as unknown,
    ]);
  });

  it("checks the knowledge fields of a resolved rule", () => {
    const rule = (fields: Record<string, unknown>) =>
      validate([layer("project", { rules: { "PYD-1": { text: "x", ...fields } } })], suggest)
        .problems;
    expect(rule({ kind: "knowledge", verified: "2026-10-01" })).toEqual([
      expect.objectContaining({
        key: "rules.PYD-1.source",
        message: "required, missing",
      }) as unknown,
    ]);
    expect(rule({ source: "https://x" })).toEqual([
      expect.objectContaining({
        key: "rules.PYD-1.source",
        message: "belongs to knowledge rules only",
      }) as unknown,
    ]);
    expect(rule({ kind: "knowledge", source: "https://x", verified: "soon" })).toEqual([
      expect.objectContaining({ key: "rules.PYD-1.verified" }) as unknown,
    ]);
  });

  it("reports invalid stages, an invalid rule id and the removed rules.disabled", () => {
    const keys = (rules: Record<string, unknown>) =>
      validate([layer("project", { rules })], suggest).problems.map((problem) => problem.key);
    expect(keys({ "X-1": { text: "x", stages: ["deploy"] } })).toEqual(["rules.X-1.stages[0]"]);
    expect(keys({ "X-1": { text: "x", stages: ["review", "review"] } })).toEqual([
      "rules.X-1.stages",
    ]);
    expect(keys({ "-bad": { text: "x" } })).toEqual(["rules.-bad"]);
    expect(keys({ disabled: ["BDK-DP-2"] })).toEqual(["rules.disabled"]);
  });
});
