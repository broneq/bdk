import { describe, expect, it } from "vitest";

import { startupContext } from "../../ctx/index.ts";
import { settingsRegistry } from "../../registrations.ts";
import { SNAPSHOT_PATH } from "../../shared/config/index.ts";
import { FORMATTER_GUARD, memoryStore } from "../../shared/store/index.ts";
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
  "# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/dist-v3.0.0/schema/settings.json\n";

const GUARD_PATH = ".bdk/.prettierrc";
const GUARD_WARNING =
  "[BDK] WARNING: .bdk/.prettierrc is missing or is not the BDK formatter guard, so Prettier can rewrite files under .bdk/ and break their recorded hashes. " +
  `Restore it: write ${FORMATTER_GUARD.trimEnd()} to .bdk/.prettierrc and commit it.`;

/** A BDK project (any `.bdk/` file) gets the formatter guard unless `guard` is false. */
function run(project: Record<string, string>, { inGit = true, guard = true } = {}) {
  const files: Record<string, string> = { ...PLUGIN_FILES };
  const bdk = Object.keys(project).some((path) => path.startsWith(".bdk/"));
  const withGuard = bdk && guard ? { [GUARD_PATH]: FORMATTER_GUARD, ...project } : project;
  for (const [path, text] of Object.entries(withGuard)) files[`${PROJECT}/${path}`] = text;
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

function projectRule(id: string, extra = ""): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\n${extra}---\n\nText of ${id}.\n`;
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

  it("reports a settings file that is not YAML as a config line, never as a STOP block", () => {
    const { report, startup } = run({ ".bdk/settings.yaml": "diagnostics: [\n" });
    const lines = problemLines(report.content, startup);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[BDK\] config: .+settings\.yaml is not valid YAML at line 2/);
    expect(report.content).not.toContain("BDK STOP");
  });

  it("reports a warning of config check as a config warning line", () => {
    const { report, startup } = run({ ".bdk/settings.yaml": "languages: [go]\n" });
    expect(problemLines(report.content, startup)).toStrictEqual([
      "[BDK] config warning: .bdk/settings.yaml: no yaml-language-server modeline; bdk doctor --fix adds it",
    ]);
  });

  it("reports a v2 layout once, without the legacy-settings warning [AC-5]", () => {
    const { report, startup } = run({
      ".bdk/settings.yaml": `${MODELINE}languages: [go]\n`,
      ".bdk/settings.json": "{}",
      ".bdk/runs/one.json": "{}",
    });
    expect(problemLines(report.content, startup)).toStrictEqual([
      "[BDK] v2 layout detected (.bdk/settings.json, .bdk/runs/): run /bdk:setup.",
    ]);
    expect(report.layout).toBe("v2");
  });

  it("names the v2 design and plan verification directories", () => {
    const { report, startup } = run({
      ".bdk/settings.yaml": `${MODELINE}languages: [go]\n`,
      ".bdk/design/a.md": "",
      ".bdk/verify-plan/a-verification.md": "",
    });
    expect(problemLines(report.content, startup)).toStrictEqual([
      "[BDK] v2 layout detected (.bdk/design/, .bdk/verify-plan/): run /bdk:setup.",
    ]);
  });

  it("warns when the heaviest role reads more rules than rules.warn-above, scoped ones counted", () => {
    const { report, startup } = run({
      ".bdk/settings.yaml": `${MODELINE}rules:\n  warn-above: 2\n`,
      ".bdk/rules/API-1.md": projectRule("API-1"),
      ".bdk/rules/API-2.md": projectRule("API-2"),
      ".bdk/rules/UI-1.md": projectRule("UI-1", "applies: [web/**]\n"),
      ".bdk/rules/PLAN-1.md": projectRule("PLAN-1", "roles: [verifier]\n"),
    });
    expect(problemLines(report.content, startup)).toStrictEqual([
      "[BDK] rules warning: verifier reads 4 rules (rules.warn-above: 2); switch rules off with rules.disabled or narrow them with applies.",
    ]);
    expect(report.configProblems).toBe(0);
  });

  it("warns first when the formatter guard is missing and never writes it", () => {
    const { report, startup, store } = run(
      { ".bdk/settings.yaml": "languages: [go]\n" },
      { guard: false },
    );
    expect(problemLines(report.content, startup)).toStrictEqual([
      GUARD_WARNING,
      "[BDK] config warning: .bdk/settings.yaml: no yaml-language-server modeline; bdk doctor --fix adds it",
    ]);
    expect(report.content).not.toContain("BDK STOP");
    expect(store.exists(`${PROJECT}/${GUARD_PATH}`)).toBe(false);
  });

  it.each([
    ["the pragma alone", '{ "requirePragma": true }'],
    ["another configuration", '{"semi": false}'],
    ["broken syntax", "{ requirePragma: ["],
  ])("warns about a guard that is not in force: %s, and leaves its bytes", (_, text) => {
    const { report, startup, store } = run({
      ".bdk/settings.yaml": `${MODELINE}languages: [go]\n`,
      [GUARD_PATH]: text,
    });
    expect(problemLines(report.content, startup)).toStrictEqual([GUARD_WARNING]);
    expect(store.read(`${PROJECT}/${GUARD_PATH}`)).toBe(text);
  });

  it("stays silent at rules.warn-above and counts no disabled rule", () => {
    const { report, startup } = run({
      ".bdk/settings.yaml": `${MODELINE}rules:\n  warn-above: 2\n  disabled: [API-3]\n`,
      ".bdk/rules/API-1.md": projectRule("API-1"),
      ".bdk/rules/API-2.md": projectRule("API-2"),
      ".bdk/rules/API-3.md": projectRule("API-3"),
    });
    expect(problemLines(report.content, startup)).toStrictEqual([]);
  });
});

describe("hooks session-start: verbose marker", () => {
  const MARKER = `${PROJECT}/.bdk/.machine/verbose`;

  it("creates the marker when diagnostics.verbose is true and removes it when it is not", () => {
    const on = run({ ".bdk/settings.yaml": `${MODELINE}diagnostics:\n  verbose: true\n` });
    expect(on.store.exists(MARKER)).toBe(true);
    const files = { ".bdk/settings.yaml": `${MODELINE}diagnostics:\n  verbose: false\n` };
    const off = run({ ...files, ".bdk/.machine/verbose": "" });
    expect(off.store.exists(MARKER)).toBe(false);
  });

  it("follows the local layer", () => {
    const { store } = run({
      ".bdk/settings.yaml": MODELINE,
      ".bdk/settings.local.yaml": `${MODELINE}diagnostics:\n  verbose: true\n`,
    });
    expect(store.exists(MARKER)).toBe(true);
  });

  it("removes the marker when the settings do not resolve", () => {
    for (const settings of ["diagnostics:\n  verbose: maybe\n", "diagnostics: [\n"]) {
      const { store } = run({ ".bdk/settings.yaml": settings, ".bdk/.machine/verbose": "" });
      expect(store.exists(MARKER)).toBe(false);
    }
  });
});
