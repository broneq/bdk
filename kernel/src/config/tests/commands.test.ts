// The four handlers through the registry on an in-memory store: argument and
// flag wiring, text rendering and refusals.
import { describe, expect, it } from "vitest";

import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import { settingsRegistry } from "../../registrations.ts";
import { createRegistry, loadIndex } from "../../shared/registry/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { configRegistrations } from "../index.ts";

const ROOT = "/work/repo";
const HOME = "/home/dev";
const MODELINE =
  "# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json";

async function run(argv: string[], files: Record<string, string> = {}) {
  const store = memoryStore({
    "/plugins/bdk/.claude-plugin/plugin.json": '{"version":"3.0.0"}',
    ...files,
  });
  const registry = createRegistry(
    loadIndex(commands),
    configRegistrations({ store, pluginRoot: "/plugins/bdk", settings: settingsRegistry() }),
  );
  let stdout = "";
  const code = await registry.run({
    argv,
    cwd: `${ROOT}/src`,
    runtime: {
      nodeVersion: "24.21.0",
      env: {},
      platform: "linux",
      home: HOME,
      workTree: () => ROOT,
      which: () => undefined,
    },
    streams: { stdout: (text) => (stdout += text), stderr: () => undefined },
  });
  return { code, stdout, store };
}

const TOOLS = `${MODELINE}\ntools:\n  test:\n    - id: unit\n      tier: fast\n      command: pnpm test\n      when: always\n`;

describe("config show", () => {
  it("prints the value as YAML in text mode", async () => {
    const result = await run(["config", "show", "tools.test"], {
      [`${ROOT}/.bdk/settings.yaml`]: TOOLS,
    });
    expect(result).toMatchObject({
      code: 0,
      stdout: "- id: unit\n  command: pnpm test\n  when: always\n  tier: fast\n",
    });
  });

  it("appends the origins in text mode with --origins", async () => {
    const result = await run(["config", "show", "features", "--origins"]);
    expect(result.stdout).toBe("lavish: true\n# origins\nfeatures.lavish: default\n");
  });

  it("answers --json with the report", async () => {
    const result = await run(["config", "show", "features.lavish", "--json"]);
    expect(JSON.parse(result.stdout)).toMatchObject({ key: "features.lavish", value: true });
  });

  it("refuses an unknown key with exit 2", async () => {
    expect((await run(["config", "show", "tools.tests"])).code).toBe(2);
  });
});

describe("config check", () => {
  it("renders warnings, the snapshot and the overridden keys", async () => {
    const result = await run(["config", "check"], {
      [`${ROOT}/.bdk/settings.yaml`]: "languages: [go]\n",
      [`${ROOT}/.bdk/settings.local.yaml`]: `${MODELINE}\nfeatures:\n  lavish: false\n`,
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      [
        "warn missing-modeline .bdk/settings.yaml: no yaml-language-server modeline; bdk doctor --fix adds it",
        "snapshot: .bdk/.machine/config/resolved.yaml",
        "overridden by global or local: features.lavish",
        "",
      ].join("\n"),
    );
  });

  it("says the settings are valid without warnings or .bdk/", async () => {
    expect((await run(["config", "check"])).stdout).toBe("settings valid\n");
  });
});

describe("config schema", () => {
  it("prints the URL and the offline copy with --url", async () => {
    expect((await run(["config", "schema", "--url"])).stdout).toBe(
      "https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json\noffline copy: .bdk/.machine/schema/settings.json\n",
    );
  });

  it("prints one module's schema as JSON", async () => {
    const result = await run(["config", "schema", "features"]);
    expect(JSON.parse(result.stdout)).toHaveProperty("properties.lavish.default", true);
  });

  it("answers exit 3 for an unknown module", async () => {
    expect((await run(["config", "schema", "policy"])).code).toBe(3);
  });
});

describe("config set", () => {
  it("writes the local layer and renders the change", async () => {
    const result = await run(["config", "set", "features.lavish", "false", "--local"], {
      [`${ROOT}/.bdk/`]: "",
    });
    expect(result.stdout).toBe(
      "features.lavish = false in the local layer (.bdk/settings.local.yaml)\n",
    );
    expect(result.store.read(`${ROOT}/.bdk/settings.local.yaml`)).toBe(
      `${MODELINE}\nfeatures:\n  lavish: false\n`,
    );
  });

  it("renders the previous value", async () => {
    const result = await run(["config", "set", "tools.test.unit.tier", "e2e"], {
      [`${ROOT}/.bdk/settings.yaml`]: TOOLS,
    });
    expect(result.stdout).toBe(
      'tools.test.unit.tier = "e2e" (was "fast") in the project layer (.bdk/settings.yaml)\n',
    );
  });

  it("writes the global layer with --global", async () => {
    const result = await run(["config", "set", "languages", "[go]", "--global", "--json"]);
    expect(JSON.parse(result.stdout)).toMatchObject({
      layer: "global",
      path: `${HOME}/.config/bdk/settings.yaml`,
    });
  });

  it("answers exit 3 for both layer flags", async () => {
    expect((await run(["config", "set", "languages", "[]", "--global", "--local"])).code).toBe(3);
  });
});
