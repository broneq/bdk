// The four use cases on an in-memory store (`kernel-architecture`, Tests per
// slice), one case per declared rule and exit of the `config` records.
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { settingsRegistry } from "../../registrations.ts";
import { OFFLINE_SCHEMA_PATH, settingsJsonSchema } from "../../shared/config/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { checkConfig } from "../use-cases/check.ts";
import { configSchema } from "../use-cases/schema.ts";
import { setConfig } from "../use-cases/set.ts";
import { showConfig } from "../use-cases/show.ts";

const PLUGIN = "/plugins/bdk";
const GLOBAL = "/home/dev/.config/bdk";
const ROOT = "/work/repo";
const PROJECT = `${ROOT}/.bdk/settings.yaml`;
const LOCAL = `${ROOT}/.bdk/settings.local.yaml`;
const GLOBAL_FILE = `${GLOBAL}/settings.yaml`;
const URL = "https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json";
const MODELINE = `# yaml-language-server: $schema=${URL}`;
const PLUGIN_FILES = {
  [`${PLUGIN}/.claude-plugin/plugin.json`]: '{"version":"3.0.0"}',
  [`${PLUGIN}/rules/security.md`]: "- default\n",
};
const settings = settingsRegistry();

function setup(files: Record<string, string>) {
  const store = memoryStore({ ...PLUGIN_FILES, ...files });
  return {
    store,
    input: { store, settings, pluginRoot: PLUGIN, globalDir: GLOBAL, projectRoot: ROOT },
  };
}

function refusal(outcome: unknown): Refusal {
  expect(outcome).toMatchObject({ refused: true });
  return outcome as Refusal;
}

const TOOLS = `${MODELINE}
tools:
  test:
    - id: unit
      tier: fast
      command: pnpm test:unit
      when: before every commit
`;

describe("showConfig", () => {
  it("shows the whole tree with defaults, prompt values and every file layer", () => {
    const { input } = setup({ [PROJECT]: "languages: [go]\n" });
    const report = showConfig(input, { origins: false });
    expect(report).toMatchObject({
      value: {
        languages: ["go"],
        features: { lavish: true },
        tools: { test: [], lint: [], build: [] },
        prompts: {
          "rules/security": { mode: "extends", files: [{ layer: "default" }] },
        },
      },
      layers: [
        { layer: "global", path: GLOBAL_FILE, present: false },
        { layer: "project", path: ".bdk/settings.yaml", present: true },
        { layer: "local", path: ".bdk/settings.local.yaml", present: false },
      ],
    });
    expect(report).not.toHaveProperty("key");
    expect(report).not.toHaveProperty("origins");
  });

  it("shows one key as YAML text including the when text", () => {
    const { input } = setup({ [PROJECT]: TOOLS });
    const report = showConfig(input, { key: "tools.test", origins: false });
    expect(report).toMatchObject({
      key: "tools.test",
      value: [{ id: "unit", tier: "fast", command: "pnpm test:unit", when: "before every commit" }],
    });
  });

  it("addresses an item of an id array by its id", () => {
    const { input } = setup({ [PROJECT]: TOOLS });
    expect(showConfig(input, { key: "tools.test.unit.tier", origins: false })).toMatchObject({
      key: "tools.test.unit.tier",
      value: "fast",
    });
  });

  it("annotates each leaf with its layer, defaults included", () => {
    const { input } = setup({
      [PROJECT]: TOOLS,
      [LOCAL]: "tools:\n  test:\n    - id: unit\n      scoped: vitest run {files}\n",
    });
    expect(showConfig(input, { key: "tools", origins: true })).toMatchObject({
      origins: {
        "tools.test.unit.tier": "project",
        "tools.test.unit.command": "project",
        "tools.test.unit.when": "project",
        "tools.test.unit.scoped": "local",
        "tools.lint": "default",
        "tools.build": "default",
      },
    });
  });

  it("shows a prompt value as its files and effective mode, never inlined", () => {
    const { input } = setup({
      [`${ROOT}/.bdk/prompts/rules/security.md`]: "---\nmode: extends\n---\n- project\n",
      [`${ROOT}/.bdk/prompts.local/rules/security.md`]: "---\nmode: replace\n---\n- local\n",
    });
    expect(showConfig(input, { key: "prompts.rules/security", origins: false })).toStrictEqual(
      expect.objectContaining({
        key: "prompts.rules/security",
        value: {
          mode: "replace",
          files: [{ layer: "local", path: ".bdk/prompts.local/rules/security.md" }],
        },
      }),
    );
  });

  it("answers input/not-found for a declared key no layer sets and without default", () => {
    const { input } = setup({});
    const outcome = refusal(showConfig(input, { key: "prompts.dir", origins: false }));
    expect(outcome.rule).toBe("input/not-found");
    expect(outcome.why).toContain("prompts.dir");
  });

  it("answers input/not-found for an id no layer declares", () => {
    const { input } = setup({ [PROJECT]: TOOLS });
    expect(refusal(showConfig(input, { key: "tools.test.e2e", origins: false })).rule).toBe(
      "input/not-found",
    );
  });

  it("refuses an unknown requested key with a hint", () => {
    const { input } = setup({});
    const outcome = refusal(showConfig(input, { key: "tools.tests", origins: false }));
    expect(outcome.rule).toBe("policy/unknown-config-key");
    expect(outcome.why).toContain("did you mean tools.test?");
  });

  it("refuses an unknown prompt key", () => {
    const { input } = setup({});
    expect(refusal(showConfig(input, { key: "prompts.rules/nope", origins: false })).rule).toBe(
      "policy/unknown-config-key",
    );
  });

  it("refuses when a layer holds an invalid value", () => {
    const { input } = setup({ [PROJECT]: "features:\n  lavish: maybe\n" });
    const outcome = refusal(showConfig(input, { origins: false }));
    expect(outcome.rule).toBe("policy/config-invalid");
    expect(outcome.why).toContain("features.lavish");
  });
});

describe("checkConfig", () => {
  it("refuses an unknown key naming key, layer, file, the count and the fix", () => {
    const { input, store } = setup({
      [GLOBAL_FILE]: `${MODELINE}\nlanguages: [go]\n`,
      [PROJECT]: `${MODELINE}\ntools:\n  tests: []\nfeaturs: {}\n`,
    });
    const outcome = refusal(checkConfig(input));
    expect(outcome).toStrictEqual({
      refused: true,
      rule: "policy/unknown-config-key",
      why: "tools.tests in the project layer (.bdk/settings.yaml): unknown key; did you mean tools.test? (1 more error)",
      instead: ["bdk config schema tools", "fix .bdk/settings.yaml"],
    });
    expect(store.exists(`${ROOT}/.bdk/.machine`)).toBe(false);
  });

  it("names the owner task of a planned key", () => {
    const { input } = setup({ [PROJECT]: "policy:\n  gates:\n    design: true\n" });
    const outcome = refusal(checkConfig(input));
    expect(outcome.why).toBe(
      "policy.gates.design in the project layer (.bdk/settings.yaml): lands with T21",
    );
    expect(outcome.instead).toStrictEqual(["bdk config schema", "fix .bdk/settings.yaml"]);
  });

  it("names the replacement of a removed v2 key", () => {
    const { input } = setup({ [PROJECT]: "features:\n  serena: true\n" });
    const outcome = refusal(checkConfig(input));
    expect(outcome.rule).toBe("policy/unknown-config-key");
    expect(outcome.why).toMatch(/^features\.serena in the project layer .*removed v2 key/);
  });

  it("refuses an invalid value", () => {
    const { input } = setup({ [LOCAL]: "languages: go\n" });
    const outcome = refusal(checkConfig(input));
    expect(outcome.rule).toBe("policy/config-invalid");
    expect(outcome.why).toMatch(/^languages in the local layer \(\.bdk\/settings\.local\.yaml\): /);
  });

  it("warns on a missing and an outdated modeline and a v2 settings file", () => {
    const { input } = setup({
      [GLOBAL_FILE]: "languages: [go]\n",
      [PROJECT]: "# yaml-language-server: $schema=https://x/v2.6.0/schema/settings.json\n",
      [`${ROOT}/.bdk/settings.json`]: "{}",
    });
    expect(checkConfig(input)).toMatchObject({
      problems: [
        { layer: "global", path: GLOBAL_FILE, code: "missing-modeline" },
        { layer: "project", path: ".bdk/settings.yaml", code: "schema-outdated" },
        {
          layer: "project",
          path: ".bdk/settings.json",
          code: "legacy-settings",
          message: expect.stringContaining("bdk import") as unknown,
        },
      ],
    });
  });

  it("writes the snapshot and the offline copy in a project with .bdk/", () => {
    const { input, store } = setup({
      [PROJECT]: `${MODELINE}\nlanguages: [go]\n`,
      [LOCAL]: `${MODELINE}\nfeatures:\n  lavish: false\n`,
    });
    expect(checkConfig(input)).toStrictEqual({
      problems: [],
      snapshot: ".bdk/.machine/config/resolved.yaml",
      overriddenKeys: ["features.lavish"],
    });
    const snapshot = parse(store.read(`${ROOT}/.bdk/.machine/config/resolved.yaml`) ?? "") as {
      resolved: { features: { lavish: boolean } };
    };
    expect(snapshot.resolved.features.lavish).toBe(false);
    expect(JSON.parse(store.read(`${ROOT}/${OFFLINE_SCHEMA_PATH}`) ?? "")).toStrictEqual(
      settingsJsonSchema(settings),
    );
  });

  it("writes nothing without .bdk/", () => {
    const { input, store } = setup({ [GLOBAL_FILE]: `${MODELINE}\nlanguages: [go]\n` });
    expect(checkConfig(input)).toStrictEqual({ problems: [], overriddenKeys: ["languages"] });
    expect(store.exists(`${ROOT}/.bdk`)).toBe(false);
  });
});

describe("configSchema", () => {
  it("prints the whole settings schema with the URL and the offline copy", () => {
    const { input } = setup({});
    expect(configSchema(input, { url: false })).toStrictEqual({
      schema: settingsJsonSchema(settings),
      url: URL,
      offlineCopy: OFFLINE_SCHEMA_PATH,
    });
  });

  it("prints one module's part", () => {
    const { input } = setup({});
    const report = configSchema(input, { module: "tools", url: false });
    expect(report).toMatchObject({ module: "tools", url: URL });
    expect(report).toHaveProperty("schema.properties.test");
  });

  it("prints only the URL and the offline copy with --url", () => {
    const { input } = setup({});
    expect(configSchema(input, { url: true })).toStrictEqual({
      url: URL,
      offlineCopy: OFFLINE_SCHEMA_PATH,
    });
  });

  it("answers input/not-found for an unregistered module", () => {
    const { input } = setup({});
    const outcome = refusal(configSchema(input, { module: "policy", url: false }));
    expect(outcome.rule).toBe("input/not-found");
    expect(outcome.why).toContain("policy");
  });
});

describe("setConfig", () => {
  it("writes the project layer by default, starting a new file with the modeline", () => {
    const { input, store } = setup({ [`${ROOT}/.bdk/`]: "" });
    expect(setConfig(input, { key: "languages", value: "[go, ts]" })).toStrictEqual({
      key: "languages",
      value: ["go", "ts"],
      layer: "project",
      path: ".bdk/settings.yaml",
    });
    expect(store.read(PROJECT)).toBe(`${MODELINE}\nlanguages: [go, ts]\n`);
  });

  it("writes the local layer with --local and reports the previous value", () => {
    const { input, store } = setup({ [LOCAL]: `${MODELINE}\nfeatures:\n  lavish: true\n` });
    expect(setConfig(input, { key: "features.lavish", value: "false", local: true })).toStrictEqual(
      {
        key: "features.lavish",
        value: false,
        previous: true,
        layer: "local",
        path: ".bdk/settings.local.yaml",
      },
    );
    expect(store.read(LOCAL)).toBe(`${MODELINE}\nfeatures:\n  lavish: false\n`);
    const snapshot = store.read(`${ROOT}/.bdk/.machine/config/resolved.yaml`) ?? "";
    expect(snapshot).toContain("- features.lavish");
  });

  it("writes the global layer with --global", () => {
    const { input, store } = setup({});
    expect(
      setConfig(input, { key: "features.lavish", value: "false", global: true }),
    ).toMatchObject({
      layer: "global",
      path: GLOBAL_FILE,
    });
    expect(store.read(GLOBAL_FILE)).toBe(`${MODELINE}\nfeatures:\n  lavish: false\n`);
  });

  it("edits the item an id segment names and appends a new one", () => {
    const { input, store } = setup({ [PROJECT]: TOOLS });
    setConfig(input, { key: "tools.test.unit.scoped", value: "vitest run {files}" });
    setConfig(input, { key: "tools.test.e2e", value: "{id: e2e, tier: e2e, command: pnpm e2e}" });
    const tools = parse(store.read(PROJECT) ?? "") as { tools: { test: unknown[] } };
    expect(tools.tools.test).toStrictEqual([
      {
        id: "unit",
        tier: "fast",
        command: "pnpm test:unit",
        when: "before every commit",
        scoped: "vitest run {files}",
      },
      { id: "e2e", tier: "e2e", command: "pnpm e2e" },
    ]);
  });

  it("keeps comments, flow sequences and key order", () => {
    const text = `${MODELINE}\n# the stack\nlanguages: [go]  # main one\nfeatures:\n  # review UI\n  lavish: true\n`;
    const { input, store } = setup({ [PROJECT]: text });
    setConfig(input, { key: "features.lavish", value: "false" });
    expect(store.read(PROJECT)).toBe(text.replace("lavish: true", "lavish: false"));
  });

  it("refuses both layer flags", () => {
    const { input } = setup({});
    expect(
      refusal(setConfig(input, { key: "languages", value: "[]", global: true, local: true })).rule,
    ).toBe("input/invalid-argument");
  });

  it("refuses a value that is not YAML", () => {
    const { input } = setup({});
    expect(refusal(setConfig(input, { key: "languages", value: "[go" })).rule).toBe(
      "input/invalid-argument",
    );
  });

  it("refuses an unknown key and changes no file", () => {
    const { input, store } = setup({ [PROJECT]: TOOLS });
    const outcome = refusal(setConfig(input, { key: "tools.tests", value: "[]" }));
    expect(outcome.rule).toBe("policy/unknown-config-key");
    expect(outcome.why).toContain("did you mean tools.test?");
    expect(store.read(PROJECT)).toBe(TOOLS);
  });

  it("refuses an invalid value and changes no file", () => {
    const { input, store } = setup({ [PROJECT]: TOOLS });
    const outcome = refusal(setConfig(input, { key: "tools.test.unit.scoped", value: "vitest" }));
    expect(outcome.rule).toBe("policy/config-invalid");
    expect(outcome.why).toContain("tools.test.unit.scoped");
    expect(store.read(PROJECT)).toBe(TOOLS);
    expect(store.exists(`${ROOT}/.bdk/.machine`)).toBe(false);
  });
});
