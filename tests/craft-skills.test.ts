import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// craft-skills spec: bdk-craft ships skills only, and a skill ships only with an
// `admitted` row in evals/RESULTS.md (design D3, D7 of v3-207-bdk-craft-plugin).

const root = join(import.meta.dirname, "..");
const plugin = join(root, "plugins", "bdk-craft");

interface Verdict {
  skill: string;
  verdict: string;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function directories(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Rows of the "## Skills" table: | `name` | ... | verdict |
function parseVerdicts(markdown: string): Verdict[] {
  const section = markdown.split(/^## /m).find((part) => part.startsWith("Skills\n"));
  if (section === undefined) return [];
  return section
    .split("\n")
    .map((line) => /^\|\s*`([a-z0-9-]+)`\s*\|.*\|\s*(admitted|rejected)\s*\|\s*$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => ({ skill: match[1] ?? "", verdict: match[2] ?? "" }));
}

function casesOf(skill: string): string[] {
  const evals = join(plugin, "evals");
  return directories(evals).filter(
    (name) =>
      name.startsWith(`${skill}-`) &&
      (existsSync(join(evals, name, "prompt.md")) || existsSync(join(evals, name, "case.yaml"))),
  );
}

describe("bdk-craft plugin", () => {
  it("has a manifest named bdk-craft", () => {
    const manifest = readJson(join(plugin, ".claude-plugin", "plugin.json")) as Record<
      string,
      unknown
    >;
    expect(manifest.name).toBe("bdk-craft");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("ships skills only", () => {
    for (const path of ["package.json", "hooks", "agents", "bin", "src", ".mcp.json"]) {
      expect(existsSync(join(plugin, path)), path).toBe(false);
    }
  });

  it("keeps every skill portable", () => {
    for (const skill of directories(join(plugin, "skills"))) {
      const text = readFileSync(join(plugin, "skills", skill, "SKILL.md"), "utf8");
      const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
      const keys = frontmatter
        .split("\n")
        .map((line) => /^([a-z-]+):/.exec(line)?.[1])
        .filter((key) => key !== undefined);
      expect(keys.sort(), skill).toEqual(["description", "license", "name"]);
      expect(frontmatter, skill).toContain(`name: ${skill}\n`);
      expect(text, `${skill} uses a ! shell block`).not.toMatch(/^!`/m);
      expect(text, `${skill} needs bdk`).not.toMatch(/\bbdk (?!craft)[a-z]+ /);
    }
  });

  it("is listed in the marketplace from the release branch", () => {
    const marketplace = readJson(join(root, ".claude-plugin", "marketplace.json")) as {
      plugins: { name: string; source: unknown }[];
    };
    const entry = marketplace.plugins.find((p) => p.name === "bdk-craft");
    expect(entry?.source).toEqual({
      source: "git-subdir",
      url: "broneq/bdk",
      path: "plugins/bdk-craft",
      ref: "release",
    });
  });
});

describe("bdk-craft admission record", () => {
  const recordPath = join(plugin, "evals", "RESULTS.md");
  const verdicts = existsSync(recordPath) ? parseVerdicts(readFileSync(recordPath, "utf8")) : [];
  const shipped = directories(join(plugin, "skills"));

  it("records a verdict for at least one skill", () => {
    expect(verdicts.length).toBeGreaterThan(0);
  });

  it("ships exactly the admitted skills", () => {
    const admitted = verdicts.filter((v) => v.verdict === "admitted").map((v) => v.skill);
    const rejected = verdicts.filter((v) => v.verdict === "rejected").map((v) => v.skill);
    expect(
      shipped.filter((s) => !admitted.includes(s)),
      "skills without an admitted row",
    ).toEqual([]);
    expect(
      admitted.filter((s) => !shipped.includes(s)),
      "admitted rows without a skill",
    ).toEqual([]);
    expect(
      rejected.filter((s) => shipped.includes(s)),
      "rejected skills still shipped",
    ).toEqual([]);
  });

  it("keeps at least two eval cases per shipped skill", () => {
    const thin = shipped.filter((skill) => casesOf(skill).length < 2);
    expect(thin, "skills with fewer than two cases").toEqual([]);
  });

  it("keeps no eval case for a skill that is not shipped", () => {
    const orphans = directories(join(plugin, "evals")).filter(
      (name) =>
        name !== "results" &&
        name !== "mocks" &&
        !shipped.some((skill) => name.startsWith(`${skill}-`)),
    );
    expect(orphans, "eval cases without a shipped skill").toEqual([]);
  });
});

describe("parseVerdicts", () => {
  it("reads skill rows of the Skills table only", () => {
    const md = [
      "# Results",
      "## Skills",
      "| Skill | Δ | Verdict |",
      "| --- | --- | --- |",
      "| `tdd` | +0.30 | admitted |",
      "| `oop-design` | +0.02 | rejected |",
      "## Cases",
      "| `tdd-slugify` | +0.30 | admitted |",
    ].join("\n");
    expect(parseVerdicts(md)).toEqual([
      { skill: "tdd", verdict: "admitted" },
      { skill: "oop-design", verdict: "rejected" },
    ]);
  });
});
