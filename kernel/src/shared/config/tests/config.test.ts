import { describe, expect, it } from "vitest";

import { KernelRefusal } from "../../refusal/index.ts";
import { memoryStore } from "../../store/index.ts";
import { pluginRootOf, readKernelVersion, readLayers, UNKNOWN_VERSION } from "../index.ts";

const PLUGIN = "/plugins/bdk";
const HOME = "/home/dev";
const PROJECT = "/work/repo";

describe("plugin manifest", () => {
  it("locates the plugin root one directory above the bundle", () => {
    expect(pluginRootOf("file:///plugins/bdk/dist/bdk.mjs")).toBe(PLUGIN);
  });

  it("reads the kernel version from .claude-plugin/plugin.json", () => {
    const store = memoryStore({
      [`${PLUGIN}/.claude-plugin/plugin.json`]: '{"name":"bdk","version":"3.1.4"}',
    });
    expect(readKernelVersion(store, PLUGIN)).toBe("3.1.4");
  });

  it.each([
    ["absent", {}],
    ["not JSON", { [`${PLUGIN}/.claude-plugin/plugin.json`]: "{" }],
    ["without a version", { [`${PLUGIN}/.claude-plugin/plugin.json`]: '{"name":"bdk"}' }],
  ])("falls back to %s", (_, files: Record<string, string>) => {
    expect(readKernelVersion(memoryStore(files), PLUGIN)).toBe(UNKNOWN_VERSION);
    expect(UNKNOWN_VERSION).toBe("0.0.0-unknown");
  });
});

describe("readLayers", () => {
  const paths = { home: HOME, projectRoot: PROJECT };

  it("returns every present layer in precedence order with its name and path", () => {
    const store = memoryStore({
      [`${HOME}/.config/bdk/settings.yaml`]: "profile: lean\n",
      [`${PROJECT}/.bdk/settings.yaml`]: "tests:\n  command: make test\n",
      [`${PROJECT}/.bdk/settings.local.yaml`]: "profile: thorough\n",
    });
    expect(readLayers(store, paths)).toStrictEqual([
      { name: "defaults", values: {} },
      { name: "personal", path: `${HOME}/.config/bdk/settings.yaml`, values: { profile: "lean" } },
      {
        name: "project",
        path: `${PROJECT}/.bdk/settings.yaml`,
        values: { tests: { command: "make test" } },
      },
      {
        name: "local",
        path: `${PROJECT}/.bdk/settings.local.yaml`,
        values: { profile: "thorough" },
      },
    ]);
  });

  it("skips absent files and reads an empty file as an empty object", () => {
    const store = memoryStore({ [`${PROJECT}/.bdk/settings.yaml`]: "" });
    expect(readLayers(store, paths)).toStrictEqual([
      { name: "defaults", values: {} },
      { name: "project", path: `${PROJECT}/.bdk/settings.yaml`, values: {} },
    ]);
  });

  it("refuses a YAML syntax error naming the file and the line", () => {
    const store = memoryStore({ [`${PROJECT}/.bdk/settings.yaml`]: "a: 1\nb: [unclosed\n" });
    const read = (): unknown => readLayers(store, paths);
    expect(read).toThrow(KernelRefusal);
    try {
      read();
    } catch (error) {
      const { refusal } = error as KernelRefusal;
      expect(refusal.rule).toBe("policy/config-invalid");
      expect(refusal.why).toContain(`${PROJECT}/.bdk/settings.yaml`);
      expect(refusal.why).toMatch(/line \d/);
    }
  });

  it("refuses a file whose top level is not a mapping", () => {
    const store = memoryStore({ [`${HOME}/.config/bdk/settings.yaml`]: "- a\n- b\n" });
    expect(() => readLayers(store, paths)).toThrow(/settings\.yaml/);
  });
});
