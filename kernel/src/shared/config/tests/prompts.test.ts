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
      key: "guides/security",
      consumer: "ctx",
      owner: "T12",
      defaultFile: "guides/security.md",
    }),
    definePromptKey({
      key: "guides/architecture",
      consumer: "ctx",
      owner: "T12",
      defaultFile: "guides/architecture.md",
    }),
    definePromptKey({
      key: "guides/languages/*",
      consumer: "ctx",
      owner: "T12",
      defaultFile: "guides/languages/{name}.md",
    }),
  ],
});

function resolve(files: Record<string, string>) {
  const store = memoryStore({
    [`${PLUGIN}/guides/security.md`]: "- default security\n",
    [`${PLUGIN}/guides/languages/go.md`]: "- default go\n",
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
      [`${GLOBAL}/prompts/guides/security.md`]: "- mine\n",
      [`${PROJECT}/.bdk/prompts/guides/security.md`]: "---\nmode: extends\n---\n- team\n",
    });
    expect(problems).toStrictEqual([]);
    expect(values.get("guides/security")).toStrictEqual({
      mode: "extends",
      files: [
        { layer: "default", path: `${PLUGIN}/guides/security.md` },
        { layer: "global", path: `${GLOBAL}/prompts/guides/security.md` },
        { layer: "project", path: `${PROJECT}/.bdk/prompts/guides/security.md` },
      ],
    });
  });

  it("lets a replace contribution discard everything below it", () => {
    const { values } = resolve({
      [`${PROJECT}/.bdk/prompts/guides/security.md`]: "---\nmode: extends\n---\n- team\n",
      [`${PROJECT}/.bdk/prompts.local/guides/security.md`]:
        "---\nmode: replace\n---\n- only mine\n",
    });
    expect(values.get("guides/security")).toStrictEqual({
      mode: "replace",
      files: [{ layer: "local", path: `${PROJECT}/.bdk/prompts.local/guides/security.md` }],
    });
  });

  it("lists every literal key, with an empty file list when nothing contributes", () => {
    expect(resolve({}).values.get("guides/architecture")).toStrictEqual({
      mode: "extends",
      files: [],
    });
  });

  it("maps a file from anywhere with prompts.files, winning over the directory", () => {
    const { values, problems } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]:
        "prompts:\n  files:\n    guides/security: docs/security-rules.md\n",
      [`${PROJECT}/docs/security-rules.md`]: "- from docs\n",
      [`${PROJECT}/.bdk/prompts/guides/security.md`]: "- ignored\n",
    });
    expect(problems).toStrictEqual([]);
    expect(values.get("guides/security")?.files).toStrictEqual([
      { layer: "default", path: `${PLUGIN}/guides/security.md` },
      { layer: "project", path: `${PROJECT}/docs/security-rules.md` },
    ]);
  });

  it("takes mode and applies from the object form", () => {
    const { values } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]:
        "prompts:\n  files:\n    guides/security: {path: sec.md, mode: replace, applies: ['src/**']}\n",
      [`${PROJECT}/sec.md`]: "- x\n",
    });
    expect(values.get("guides/security")).toStrictEqual({
      mode: "replace",
      files: [{ layer: "project", path: `${PROJECT}/sec.md`, applies: ["src/**"] }],
    });
  });

  it("refuses a frontmatter that contradicts the YAML entry", () => {
    const { problems } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]:
        "prompts:\n  files:\n    guides/security: {path: sec.md, mode: replace}\n",
      [`${PROJECT}/sec.md`]: "---\nmode: extends\n---\n- x\n",
    });
    expect(problems).toMatchObject([
      {
        rule: "policy/config-invalid",
        key: "prompts.guides/security",
        layer: "project",
        path: `${PROJECT}/sec.md`,
      },
    ]);
  });

  it("refuses a mapped file that does not exist", () => {
    const { problems } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]: "prompts:\n  files:\n    guides/security: nope.md\n",
    });
    expect(problems).toMatchObject([
      { rule: "policy/config-invalid", key: "prompts.files.guides/security", layer: "project" },
    ]);
  });

  it("reads each layer's own prompts.dir and never inherits it", () => {
    const { values } = resolve({
      [`${PROJECT}/.bdk/settings.yaml`]: "prompts:\n  dir: docs/bdk-prompts\n",
      [`${PROJECT}/docs/bdk-prompts/guides/architecture.md`]: "- team\n",
      [`${PROJECT}/.bdk/prompts/guides/architecture.md`]: "- not read\n",
      [`${PROJECT}/.bdk/prompts.local/guides/architecture.md`]: "- local\n",
    });
    expect(values.get("guides/architecture")?.files).toStrictEqual([
      { layer: "project", path: `${PROJECT}/docs/bdk-prompts/guides/architecture.md` },
      { layer: "local", path: `${PROJECT}/.bdk/prompts.local/guides/architecture.md` },
    ]);
  });

  it("resolves a relative global prompts.dir against the global directory", () => {
    const { values } = resolve({
      [`${GLOBAL}/settings.yaml`]: "prompts:\n  dir: my-prompts\n",
      [`${GLOBAL}/my-prompts/guides/architecture.md`]: "- mine\n",
    });
    expect(values.get("guides/architecture")?.files).toStrictEqual([
      { layer: "global", path: `${GLOBAL}/my-prompts/guides/architecture.md` },
    ]);
  });

  it("resolves pattern keys from layer files and plugin defaults", () => {
    const { values } = resolve({
      [`${PROJECT}/.bdk/prompts/guides/languages/elixir.md`]: "- ex\n",
    });
    expect(values.get("guides/languages/go")?.files).toStrictEqual([
      { layer: "default", path: `${PLUGIN}/guides/languages/go.md` },
    ]);
    expect(values.get("guides/languages/elixir")?.files).toStrictEqual([
      { layer: "project", path: `${PROJECT}/.bdk/prompts/guides/languages/elixir.md` },
    ]);
  });

  it("refuses an unknown prompt file naming key and layer, and ignores non-Markdown files", () => {
    const { problems } = resolve({
      [`${PROJECT}/.bdk/prompts/guides/secrity.md`]: "- typo\n",
      [`${PROJECT}/.bdk/prompts/README.txt`]: "notes\n",
    });
    expect(problems).toStrictEqual([
      {
        rule: "policy/unknown-config-key",
        key: "prompts.guides/secrity",
        layer: "project",
        path: `${PROJECT}/.bdk/prompts/guides/secrity.md`,
        message: "no prompt key guides/secrity is registered; did you mean guides/security?",
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
    const { problems } = resolve({ [`${PROJECT}/.bdk/prompts/guides/security.md`]: text });
    expect(problems).toMatchObject([
      { rule: "policy/config-invalid", key: "prompts.guides/security", layer: "project" },
    ]);
  });
});

describe("promptContent", () => {
  it("reads the bodies on demand, without frontmatter, separated by a blank line", () => {
    const { values, store } = resolve({
      [`${PROJECT}/.bdk/prompts/guides/security.md`]:
        "---\nmode: extends\napplies: ['src/**']\n---\n- team\n",
    });
    const value = values.get("guides/security");
    expect(value).toBeDefined();
    if (value !== undefined) {
      expect(promptContent(store, value)).toBe("- default security\n\n- team\n");
    }
  });

  it("reads only layer files while resolving, never the plugin defaults", () => {
    const reads: string[] = [];
    const base = memoryStore({ [`${PROJECT}/.bdk/prompts/guides/security.md`]: "- team\n" });
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
      `${PROJECT}/.bdk/prompts/guides/security.md`,
    ]);
  });
});
