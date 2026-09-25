import { describe, expect, it } from "vitest";

import { memoryStore } from "../../store/index.ts";
import type { Store } from "../../store/index.ts";
import {
  createConfigRegistry,
  definePromptKey,
  promptContent,
  readLayers,
  resolvePrompts,
} from "../index.ts";

const PLUGIN = "/plugin";
const GLOBAL = "/home/dev/.config/bdk";
const PROJECT = "/repo";

const registry = createConfigRegistry({
  modules: [],
  prompts: [
    definePromptKey({
      key: "rules/security",
      consumer: "ctx",
      owner: "T12",
      defaultFile: "rules/security.md",
    }),
    definePromptKey({
      key: "rules/architecture",
      consumer: "ctx",
      owner: "T12",
      defaultFile: "rules/architecture.md",
    }),
    definePromptKey({
      key: "rules/languages/*",
      consumer: "ctx",
      owner: "T12",
      defaultFile: "rules/languages/{name}.md",
    }),
  ],
});

function resolve(files: Record<string, string>) {
  const store = memoryStore({
    [`${PLUGIN}/rules/security.md`]: "- default security\n",
    [`${PLUGIN}/rules/languages/go.md`]: "- default go\n",
    ...files,
  });
  const layers = readLayers(store, { globalDir: GLOBAL, projectRoot: PROJECT });
  const result = resolvePrompts({
    store,
    registry,
    layers,
    globalDir: GLOBAL,
    projectRoot: PROJECT,
    pluginRoot: PLUGIN,
  });
  return { ...result, store };
}

describe("resolvePrompts", () => {
  it("starts from the plugin default and appends extends contributions per layer", () => {
    const { values, problems } = resolve({
      [`${GLOBAL}/prompts/rules/security.md`]: "- mine\n",
      [`${PROJECT}/.bdk/prompts/rules/security.md`]: "---\nmode: extends\n---\n- team\n",
    });
    expect(problems).toStrictEqual([]);
    expect(values.get("rules/security")).toStrictEqual({
      mode: "extends",
      files: [
        { layer: "default", path: `${PLUGIN}/rules/security.md` },
        { layer: "global", path: `${GLOBAL}/prompts/rules/security.md` },
        { layer: "project", path: `${PROJECT}/.bdk/prompts/rules/security.md` },
      ],
    });
  });

  it("lets a replace contribution discard everything below it", () => {
    const { values } = resolve({
      [`${PROJECT}/.bdk/prompts/rules/security.md`]: "---\nmode: extends\n---\n- team\n",
      [`${PROJECT}/.bdk/prompts.local/rules/security.md`]: "---\nmode: replace\n---\n- only mine\n",
    });
    expect(values.get("rules/security")).toStrictEqual({
      mode: "replace",
      files: [{ layer: "local", path: `${PROJECT}/.bdk/prompts.local/rules/security.md` }],
    });
  });

  it("lists every literal key, with an empty file list when nothing contributes", () => {
    expect(resolve({}).values.get("rules/architecture")).toStrictEqual({
      mode: "extends",
      files: [],
    });
  });

  it("maps a file from anywhere with prompts.files, winning over the directory", () => {
    const { values, problems } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]:
        "prompts:\n  files:\n    rules/security: docs/security-rules.md\n",
      [`${PROJECT}/docs/security-rules.md`]: "- from docs\n",
      [`${PROJECT}/.bdk/prompts/rules/security.md`]: "- ignored\n",
    });
    expect(problems).toStrictEqual([]);
    expect(values.get("rules/security")?.files).toStrictEqual([
      { layer: "default", path: `${PLUGIN}/rules/security.md` },
      { layer: "project", path: `${PROJECT}/docs/security-rules.md` },
    ]);
  });

  it("takes mode and applies from the object form", () => {
    const { values } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]:
        "prompts:\n  files:\n    rules/security: {path: sec.md, mode: replace, applies: ['src/**']}\n",
      [`${PROJECT}/sec.md`]: "- x\n",
    });
    expect(values.get("rules/security")).toStrictEqual({
      mode: "replace",
      files: [{ layer: "project", path: `${PROJECT}/sec.md`, applies: ["src/**"] }],
    });
  });

  it("refuses a frontmatter that contradicts the YAML entry", () => {
    const { problems } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]:
        "prompts:\n  files:\n    rules/security: {path: sec.md, mode: replace}\n",
      [`${PROJECT}/sec.md`]: "---\nmode: extends\n---\n- x\n",
    });
    expect(problems).toMatchObject([
      {
        rule: "policy/config-invalid",
        key: "prompts.rules/security",
        layer: "project",
        path: `${PROJECT}/sec.md`,
      },
    ]);
  });

  it("refuses a mapped file that does not exist", () => {
    const { problems } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]: "prompts:\n  files:\n    rules/security: nope.md\n",
    });
    expect(problems).toMatchObject([
      { rule: "policy/config-invalid", key: "prompts.files.rules/security", layer: "project" },
    ]);
  });

  it("reads each layer's own prompts.dir and never inherits it", () => {
    const { values } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]: "prompts:\n  dir: docs/bdk-prompts\n",
      [`${PROJECT}/docs/bdk-prompts/rules/architecture.md`]: "- team\n",
      [`${PROJECT}/.bdk/prompts/rules/architecture.md`]: "- not read\n",
      [`${PROJECT}/.bdk/prompts.local/rules/architecture.md`]: "- local\n",
    });
    expect(values.get("rules/architecture")?.files).toStrictEqual([
      { layer: "project", path: `${PROJECT}/docs/bdk-prompts/rules/architecture.md` },
      { layer: "local", path: `${PROJECT}/.bdk/prompts.local/rules/architecture.md` },
    ]);
  });

  it("resolves a relative global prompts.dir against the global directory", () => {
    const { values } = resolve({
      [`${GLOBAL}/settings.yaml`]: "prompts:\n  dir: my-prompts\n",
      [`${GLOBAL}/my-prompts/rules/architecture.md`]: "- mine\n",
    });
    expect(values.get("rules/architecture")?.files).toStrictEqual([
      { layer: "global", path: `${GLOBAL}/my-prompts/rules/architecture.md` },
    ]);
  });

  it("resolves pattern keys from layer files and plugin defaults", () => {
    const { values } = resolve({ [`${PROJECT}/.bdk/prompts/rules/languages/elixir.md`]: "- ex\n" });
    expect(values.get("rules/languages/go")?.files).toStrictEqual([
      { layer: "default", path: `${PLUGIN}/rules/languages/go.md` },
    ]);
    expect(values.get("rules/languages/elixir")?.files).toStrictEqual([
      { layer: "project", path: `${PROJECT}/.bdk/prompts/rules/languages/elixir.md` },
    ]);
  });

  it("refuses an unknown prompt file naming key and layer, and ignores non-Markdown files", () => {
    const { problems } = resolve({
      [`${PROJECT}/.bdk/prompts/rules/secrity.md`]: "- typo\n",
      [`${PROJECT}/.bdk/prompts/README.txt`]: "notes\n",
    });
    expect(problems).toStrictEqual([
      {
        rule: "policy/unknown-config-key",
        key: "prompts.rules/secrity",
        layer: "project",
        path: `${PROJECT}/.bdk/prompts/rules/secrity.md`,
        message: "no prompt key rules/secrity is registered; did you mean rules/security?",
      },
    ]);
  });

  it.each([
    ["an unknown mode", "---\nmode: merge\n---\n"],
    ["applies that is not a list", "---\napplies: src/**\n---\n"],
    ["an absolute glob", "---\napplies: ['/etc/*']\n---\n"],
    ["an unknown frontmatter field", "---\nmood: happy\n---\n"],
    ["invalid YAML", "---\nmode: [\n---\n"],
  ])("refuses %s in the frontmatter", (_, text) => {
    const { problems } = resolve({ [`${PROJECT}/.bdk/prompts/rules/security.md`]: text });
    expect(problems).toMatchObject([
      { rule: "policy/config-invalid", key: "prompts.rules/security", layer: "project" },
    ]);
  });
});

describe("promptContent", () => {
  it("reads the bodies on demand, without frontmatter, separated by a blank line", () => {
    const { values, store } = resolve({
      [`${PROJECT}/.bdk/prompts/rules/security.md`]:
        "---\nmode: extends\napplies: ['src/**']\n---\n- team\n",
    });
    const value = values.get("rules/security");
    expect(value).toBeDefined();
    if (value !== undefined) {
      expect(promptContent(store, value)).toBe("- default security\n\n- team\n");
    }
  });

  it("reads only layer files while resolving, never the plugin defaults", () => {
    const reads: string[] = [];
    const base = memoryStore({ [`${PROJECT}/.bdk/prompts/rules/security.md`]: "- team\n" });
    const store: Store = { ...base, read: (path) => (reads.push(path), base.read(path)) };
    const layers = readLayers(store, { globalDir: GLOBAL, projectRoot: PROJECT });
    resolvePrompts({
      store,
      registry,
      layers,
      globalDir: GLOBAL,
      projectRoot: PROJECT,
      pluginRoot: PLUGIN,
    });
    expect(reads.filter((path) => path.endsWith(".md"))).toStrictEqual([
      `${PROJECT}/.bdk/prompts/rules/security.md`,
    ]);
  });
});
