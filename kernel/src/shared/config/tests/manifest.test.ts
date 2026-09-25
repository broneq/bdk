import { describe, expect, it } from "vitest";

import { memoryStore } from "../../store/index.ts";
import { pluginRootOf, readKernelVersion, UNKNOWN_VERSION } from "../index.ts";

const PLUGIN = "/plugins/bdk";

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
