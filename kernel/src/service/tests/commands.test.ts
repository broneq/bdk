// The two handlers through the registry, on an in-memory store: the Node gate
// exemption of `doctor` and the standalone `version`.
import { describe, expect, it } from "vitest";

import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import { settingsRegistry } from "../../registrations.ts";
import { createRegistry, loadIndex } from "../../shared/registry/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { serviceRegistrations } from "../index.ts";

const index = loadIndex(commands);
const store = memoryStore({ "/plugins/bdk/.claude-plugin/plugin.json": '{"version":"3.0.0"}' });
const registry = createRegistry(
  index,
  serviceRegistrations({
    store,
    pluginRoot: "/plugins/bdk",
    contract: index.contract,
    settings: settingsRegistry(),
  }),
);

async function run(argv: string[], nodeVersion: string, workTree: string | undefined) {
  let stdout = "";
  const code = await registry.run({
    argv,
    cwd: "/work/repo",
    runtime: {
      nodeVersion,
      env: {},
      platform: "linux",
      home: "/home/dev",
      workTree: () => workTree,
      which: () => undefined,
    },
    streams: { stdout: (text) => (stdout += text), stderr: () => undefined },
  });
  return { code, stdout };
}

describe("service registrations", () => {
  it("answers version on an old Node outside a work tree", async () => {
    const result = await run(["version"], "22.12.0", undefined);
    expect(result).toStrictEqual({ code: 0, stdout: "bdk 3.0.0 (contract 3, node 22.12.0)\n" });
  });

  it("answers doctor on an old Node with the node-version finding", async () => {
    const result = await run(["doctor", "--json", "--fix"], "22.12.0", "/work/repo");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [{ id: "node-version" }],
    });
  });

  it("still refuses doctor outside a work tree", async () => {
    expect((await run(["doctor"], "24.21.0", undefined)).code).toBe(5);
  });
});
