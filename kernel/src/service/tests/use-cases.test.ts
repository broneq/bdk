// The two use cases on an in-memory store (`kernel-architecture`, Tests per slice).
import { describe, expect, it } from "vitest";

import { memoryStore } from "../../shared/store/index.ts";
import { doctor } from "../use-cases/doctor.ts";
import { version } from "../use-cases/version.ts";

const PLUGIN = "/plugins/bdk";
const ROOT = "/work/repo";
const MANIFEST = { [`${PLUGIN}/.claude-plugin/plugin.json`]: '{"version":"3.0.0"}' };

function run(files: Record<string, string>, nodeVersion = "24.21.0") {
  const store = memoryStore({ ...MANIFEST, ...files });
  return doctor({ store, pluginRoot: PLUGIN, contract: 3, nodeVersion, cwd: ROOT, workTree: ROOT });
}

describe("version", () => {
  it("reports kernel, contract and Node", () => {
    const store = memoryStore(MANIFEST);
    expect(
      version({ store, pluginRoot: PLUGIN, contract: 3, nodeVersion: "22.12.0" }),
    ).toStrictEqual({
      kernel: "3.0.0",
      contract: 3,
      node: "22.12.0",
    });
  });

  it("reports the unknown version without a manifest", () => {
    expect(
      version({ store: memoryStore(), pluginRoot: PLUGIN, contract: 3, nodeVersion: "24.0.0" })
        .kernel,
    ).toBe("0.0.0-unknown");
  });
});

describe("doctor", () => {
  it("is ok with no findings on a healthy project", () => {
    expect(run({ [`${ROOT}/.bdk/settings.yaml`]: "" })).toStrictEqual({
      ok: true,
      version: { kernel: "3.0.0", contract: 3, node: "24.21.0" },
      layout: "v3",
      findings: [],
    });
  });

  it("reports layout none without .bdk/", () => {
    expect(run({ [`${ROOT}/README.md`]: "" })).toMatchObject({
      ok: true,
      layout: "none",
      findings: [],
    });
  });

  it("finds the v2 layout with bdk import as the repair", () => {
    const report = run({ [`${ROOT}/.bdk/settings.json`]: "{}", [`${ROOT}/.bdk/plans/`]: "" });
    expect(report.ok).toBe(false);
    expect(report.layout).toBe("v2");
    expect(report.findings).toStrictEqual([
      {
        id: "v2-layout",
        level: "warn",
        summary: ".bdk/settings.json and .bdk/plans/ found",
        repair: "bdk import",
      },
    ]);
  });

  it("takes the layout from the nearest .bdk/ below the work tree root", () => {
    const store = memoryStore({
      ...MANIFEST,
      [`${ROOT}/pkg/.bdk/runs/`]: "",
      [`${ROOT}/.bdk/`]: "",
    });
    const report = doctor({
      store,
      pluginRoot: PLUGIN,
      contract: 3,
      nodeVersion: "24.21.0",
      cwd: `${ROOT}/pkg/src`,
      workTree: ROOT,
    });
    expect(report.layout).toBe("v2");
  });

  it.each(["22.12.9", "23.3.0"])(
    "fails the node-version check on %s with an install line",
    (nodeVersion) => {
      const report = run({}, nodeVersion);
      expect(report.ok).toBe(false);
      expect(report.findings).toStrictEqual([
        {
          id: "node-version",
          level: "fail",
          summary: `Node ${nodeVersion} is below 22.13.0; node:sqlite needs a flag`,
          repair: "nvm install 24 && nvm use 24",
        },
      ]);
    },
  );

  it.each(["22.13.0", "23.4.0", "26.9.0"])("passes the node-version check on %s", (nodeVersion) => {
    expect(run({}, nodeVersion).findings).toStrictEqual([]);
  });

  it("never names uv, uvx or an MCP server", () => {
    const text = JSON.stringify(run({ [`${ROOT}/.bdk/settings.json`]: "{}" }, "22.12.0"));
    expect(text).not.toMatch(/\buvx?\b|mcp/i);
  });
});
