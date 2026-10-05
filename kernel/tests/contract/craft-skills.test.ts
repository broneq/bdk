// `craft-skills` (v3-t42-craft): the `bdk-craft` plugin under plugins/bdk-craft,
// the portable shape of its skills, their admission by measurement, and the
// removal of the v2 craft skills from `bdk`.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { REPO_ROOT } from "../support/run.ts";
import { userFacingFiles, withoutRemovedSection } from "../support/user-facing.ts";

const PLUGIN = join(REPO_ROOT, "plugins", "bdk-craft");
const SKILLS_DIR = join(PLUGIN, "skills");
const REPORT = join(REPO_ROOT, "docs", "V3-EVAL-CRAFT.md");
const CRAFT = [
  "tdd",
  "debugging",
  "mermaid-drawer",
  "oop-design",
  "api-design",
  "refactoring",
  "data-modeling",
  "testing-strategy",
  "modularizing",
] as const;
const STANDARD_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
];
const REMOVED = ["debug", "test-driven-development", "mermaid-drawer"] as const;
const MODEL_NAMES = /\b(haiku|sonnet|opus|claude-[a-z0-9-]+)\b/i;

/** The skill directories `bdk-craft` ships. */
function shipped(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function frontmatter(text: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match?.[1] === undefined) throw new Error("no frontmatter");
  return parse(match[1]) as Record<string, unknown>;
}

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** The verdict of each skill in the report table, by skill name. */
function verdicts(): Map<string, string> {
  const text = existsSync(REPORT) ? readFileSync(REPORT, "utf8") : "";
  const rows = text.matchAll(/^\|\s*`([a-z-]+)`\s*\|.*\|\s*(admitted|rejected)\s*\|\s*$/gm);
  return new Map([...rows].map((row) => [String(row[1]), String(row[2])]));
}

describe("the bdk-craft plugin", () => {
  it("has its own manifest", () => {
    const path = join(PLUGIN, ".claude-plugin", "plugin.json");
    expect(existsSync(path)).toBe(true);
    const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    expect(manifest.name).toBe("bdk-craft");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is listed in the marketplace through a git-subdir source", () => {
    const marketplace = JSON.parse(
      readFileSync(join(REPO_ROOT, ".claude-plugin", "marketplace.json"), "utf8"),
    ) as { plugins: { name: string; source: unknown }[] };
    const entry = marketplace.plugins.find((plugin) => plugin.name === "bdk-craft");
    expect(entry?.source).toStrictEqual({
      source: "git-subdir",
      url: "broneq/bdk",
      path: "plugins/bdk-craft",
    });
  });

  it("holds nothing but skills", () => {
    const allowed = [".claude-plugin", "skills", "README.md", "CHANGELOG.md"];
    const entries = existsSync(PLUGIN) ? readdirSync(PLUGIN) : [];
    expect(entries).toContain("skills");
    for (const entry of entries) expect(allowed, entry).toContain(entry);
  });

  it("is versioned as its own release-please package", () => {
    const config = JSON.parse(
      readFileSync(join(REPO_ROOT, ".github", "release-please-config.json"), "utf8"),
    ) as { packages: Record<string, { "extra-files"?: { path: string }[] }> };
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, ".github", ".release-please-manifest.json"), "utf8"),
    ) as Record<string, string>;
    const pkg = config.packages["plugins/bdk-craft"];
    expect(pkg?.["extra-files"]?.map((file) => file.path) ?? []).toContain(
      ".claude-plugin/plugin.json",
    );
    expect(manifest["plugins/bdk-craft"]).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("craft skill shape", () => {
  it("ships only craft skills, at least one", () => {
    expect(shipped().length).toBeGreaterThan(0);
    for (const name of shipped()) expect(CRAFT, name).toContain(name);
  });

  it("uses the standard fields only, within 200 lines", () => {
    for (const name of shipped()) {
      const text = readFileSync(join(SKILLS_DIR, name, "SKILL.md"), "utf8");
      const meta = frontmatter(text);
      expect(meta.name, name).toBe(name);
      for (const key of Object.keys(meta))
        expect(STANDARD_FIELDS, `${name}: ${key}`).toContain(key);
      expect(text.split("\n").length, name).toBeLessThanOrEqual(200);
    }
  });

  it("names no kernel, no bdk skill and no model [EC-8]", () => {
    for (const name of shipped()) {
      for (const path of files(join(SKILLS_DIR, name))) {
        const text = readFileSync(path, "utf8");
        const where = relative(REPO_ROOT, path);
        expect(text, where).not.toContain("bdk.mjs");
        expect(text, where).not.toContain("CLAUDE_PLUGIN_ROOT");
        expect(text, where).not.toMatch(/(?<![\w-])\/?bdk:[a-z]/);
        expect(text, where).not.toMatch(/^!`/m);
        expect(text, where).not.toMatch(MODEL_NAMES);
      }
    }
  });
});

describe("admission by measurement", () => {
  it("the report has a verdict for each of the nine skills", () => {
    expect([...verdicts().keys()].sort()).toStrictEqual([...CRAFT].sort());
  });

  it("every shipped skill is admitted and every rejected one is gone", () => {
    for (const [name, verdict] of verdicts()) {
      expect(shipped().includes(name), name).toBe(verdict === "admitted");
    }
  });

  it("every skill keeps its task file", () => {
    for (const name of CRAFT) {
      const path = join(REPO_ROOT, "evals", "suites", "with-without", "examples", "craft");
      expect(existsSync(join(path, `${name}.yaml`)), name).toBe(true);
    }
  });
});

describe("the v2 craft skills leave bdk", () => {
  it("no v2 directory and no manifest entry remains", () => {
    for (const name of REMOVED) {
      expect(existsSync(join(REPO_ROOT, "skills", name)), name).toBe(false);
    }
    expect(Object.keys(SKILL_CONTEXT)).not.toContain("debug");
    expect(Object.keys(SKILL_CONTEXT)).not.toContain("test-driven-development");
  });

  it("nothing user-facing names a removed skill", () => {
    const stale = new RegExp(`(?<![\\w-])/?bdk:(${REMOVED.join("|")})(?![\\w-])`);
    const hits = userFacingFiles().filter((path) =>
      stale.test(withoutRemovedSection(readFileSync(path, "utf8"))),
    );
    expect(hits.map((path) => relative(REPO_ROOT, path))).toStrictEqual([]);
  });
});
