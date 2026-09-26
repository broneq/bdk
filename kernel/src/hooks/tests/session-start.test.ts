import { describe, expect, it } from "vitest";

import { startupContext } from "../../ctx/index.ts";
import { settingsRegistry } from "../../registrations.ts";
import { SNAPSHOT_PATH } from "../../shared/config/index.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { renderSessionStart } from "../render/session-start.ts";
import { sessionStart } from "../use-cases/session-start.ts";

const PLUGIN = "/plugin";
const PROJECT = "/repo";

const STARTUP =
  "# BDK Shared Foundation\n\n<!-- bdk:agents-table -->\n<!-- /bdk:agents-table -->\n";
const PLUGIN_FILES = {
  [`${PLUGIN}/STARTUP_INSTRUCTIONS.md`]: STARTUP,
  [`${PLUGIN}/agents/explorer.md`]: "---\nname: explorer\ndescription: Search\nmodel: haiku\n---\n",
  [`${PLUGIN}/.claude-plugin/plugin.json`]: '{"version": "3.0.0"}',
};
const MODELINE =
  "# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json\n";

function run(project: Record<string, string>, { inGit = true } = {}) {
  const files: Record<string, string> = { ...PLUGIN_FILES };
  for (const [path, text] of Object.entries(project)) files[`${PROJECT}/${path}`] = text;
  const store = memoryStore(files);
  const deps = { store, pluginRoot: PLUGIN, settings: settingsRegistry() };
  const report = renderSessionStart(
    sessionStart({
      ...deps,
      cwd: PROJECT,
      workTree: inGit ? PROJECT : undefined,
      globalDir: "/home/dev/.config/bdk",
    }),
  );
  return { store, report, startup: startupContext(deps).content };
}

function problemLines(content: string, startup: string): string[] {
  expect(content.startsWith(startup)).toBe(true);
  return content
    .slice(startup.length)
    .split("\n")
    .filter((line) => line !== "");
}

describe("hooks session-start", () => {
  it("prints the STARTUP text alone outside a BDK project and writes nothing", () => {
    const { report, startup, store } = run({});
    expect(report).toStrictEqual({ content: startup });
    expect(store.exists(`${PROJECT}/.bdk`)).toBe(false);
  });

  it("prints the STARTUP text alone outside a git work tree", () => {
    const { report, startup } = run({ ".bdk/settings.yaml": "nope: 1\n" }, { inGit: false });
    expect(report).toStrictEqual({ content: startup });
  });

  it("stays silent with registered keys, a current modeline and no v2 marker", () => {
    const { report, startup, store } = run({
      ".bdk/settings.yaml": `${MODELINE}languages: [go]\n`,
    });
    expect(report).toStrictEqual({ content: startup, layout: "v3", configProblems: 0 });
    expect(store.exists(`${PROJECT}/${SNAPSHOT_PATH}`)).toBe(true);
  });

  it("reports a removed key as a config line, never as a STOP block", () => {
    const { report, startup } = run({
      ".bdk/settings.yaml": `${MODELINE}features:\n  serena: true\n`,
    });
    const lines = problemLines(report.content, startup);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^\[BDK\] config: features\.serena in the project layer \(\.bdk\/settings\.yaml\): removed v2 key: .+ Instead: .+$/,
    );
    expect(report.content).not.toContain("BDK STOP");
    expect(report.configProblems).toBe(1);
  });

  it("reports every unknown key and invalid value on its own line", () => {
    const { report, startup } = run({
      ".bdk/settings.yaml": `${MODELINE}tools:\n  tests: []\nfeatures:\n  lavish: maybe\n`,
    });
    const lines = problemLines(report.content, startup);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(
      /^\[BDK\] config: tools\.tests in the project layer .+did you mean tools\.test\?/,
    );
    expect(lines[1]).toMatch(/^\[BDK\] config: features\.lavish in the project layer /);
    expect(report.configProblems).toBe(2);
  });

  it("reports a warning of config check as a config warning line", () => {
    const { report, startup } = run({ ".bdk/settings.yaml": "languages: [go]\n" });
    expect(problemLines(report.content, startup)).toStrictEqual([
      "[BDK] config warning: .bdk/settings.yaml: no yaml-language-server modeline; bdk doctor --fix adds it",
    ]);
  });

  it("reports a v2 layout once, without the legacy-settings warning", () => {
    const { report, startup } = run({
      ".bdk/settings.yaml": `${MODELINE}languages: [go]\n`,
      ".bdk/settings.json": "{}",
      ".bdk/runs/one.json": "{}",
    });
    expect(problemLines(report.content, startup)).toStrictEqual([
      "[BDK] v2 layout detected (.bdk/settings.json, .bdk/runs/): run bdk import.",
    ]);
    expect(report.layout).toBe("v2");
  });
});
