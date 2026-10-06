// `docs-site`, Site describes only shipped mechanisms: no page names the
// removed tool layer, the v2 settings file's hook and renderer, or a Python
// script or hook of BDK, and neither the site nor `README.md` names a v2
// workflow outside the migration page. The include pages are skipped:
// `CHANGELOG.md` records removals by name, and both included files have checks
// of their own.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "../support/run.ts";
import { isSnippetPage, readPage, sitePages } from "./site.ts";

const REMOVED: readonly (readonly [string, RegExp])[] = [
  ["the tool tiers", /tool-tiers|tool tier|choosing-a-tier/i],
  ["the graph repository hook", /register-graph-repo/],
  ["a bundled MCP config", /\.mcp\.json/],
  ["the v2 settings hook", /check-bdk-config/],
  ["the v2 startup renderer", /render_startup/],
  ["the removed settings page", /reference\/settings\.md/],
  ["the v2 run-state script", /bdk_run_state/],
  ["the command check hook", /is-command-exists/],
  ["the sentinel script", /sentinel-echo/],
  ["a Python script or hook", /(scripts|hooks)\/\S*\.py/],
];

const CONFIG_DIR = join(REPO_ROOT, "docs", "guide", ".vitepress");

const sources = [
  ...sitePages()
    .filter((page) => !isSnippetPage(readPage(page)))
    .map((page) => ({ name: page, text: readPage(page) })),
  ...readdirSync(CONFIG_DIR, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(ts|css)$/.test(path) && !/^(dist|cache)\//.test(path))
    .map((path) => ({
      name: `.vitepress/${path}`,
      text: readFileSync(join(CONFIG_DIR, path), "utf8"),
    })),
];

/** The removed mechanisms that `text` names, by label. */
function named(text: string): string[] {
  return REMOVED.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

describe("site describes only shipped mechanisms", () => {
  it("reads the pages and the config", () => {
    expect(sources.length).toBeGreaterThan(sitePages().length / 2);
  });

  it.each([
    ["see `scripts/bdk_run_state.py`", "the v2 run-state script"],
    ["run `hooks/x/check.py`", "a Python script or hook"],
    ["pick a tool tier", "the tool tiers"],
  ])("flags %s", (text, label) => {
    expect(named(text)).toContain(label);
  });

  it("does not flag a project's own Python files", () => {
    expect(named("detects `pyproject.toml` and runs `pytest {files}`")).toStrictEqual([]);
  });

  it.each(sources)("$name names no removed mechanism", ({ text }) => {
    expect(named(text)).toStrictEqual([]);
  });
});

// Scenario "v2 workflow outside the migration page": the one page that maps
// the v2 skills and paths to v3 is the only place that names them.
const MIGRATION_PAGE = "getting-started/migration-from-v2.md";

const V2_WORKFLOW =
  /create-plan|subagent-execute-plan|refine-rules|add-rule|\.bdk\/(?:plans|design|runs|verify-plan)\//g;

const workflowSources = [
  { name: "README.md", text: readFileSync(join(REPO_ROOT, "README.md"), "utf8") },
  ...sources.filter(({ name }) => name.endsWith(".md") && name !== MIGRATION_PAGE),
];

/** `line: match` for every v2 skill or path that `text` names. */
function v2Mentions(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line, index) =>
      [...line.matchAll(V2_WORKFLOW)].map((match) => `${String(index + 1)}: ${match[0]}`),
    );
}

describe("no v2 workflow outside the migration page", () => {
  it.each([
    ["run `/bdk:create-plan`", "1: create-plan"],
    ["plans live in `.bdk/plans/`", "1: .bdk/plans/"],
  ])("flags %s", (text, mention) => {
    expect(v2Mentions(text)).toStrictEqual([mention]);
  });

  it("does not flag the v3 paths", () => {
    expect(v2Mentions("`.bdk/changes/<id>/plan/parts/` and `.bdk/rules/`")).toStrictEqual([]);
  });

  it.each(workflowSources)("$name names no v2 skill or path", ({ text }) => {
    expect(v2Mentions(text), `the v2 workflow belongs on ${MIGRATION_PAGE}`).toStrictEqual([]);
  });
});
