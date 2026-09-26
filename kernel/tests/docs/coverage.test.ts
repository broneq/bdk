// `docs-site`, Drift guards 1-3: every user-invocable skill and every agent
// has its reference entry, and the nav of mkdocs.yml equals the site pages.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { REPO_ROOT } from "../support/run.ts";
import { readMkdocs, readPage, sitePages } from "./site.ts";

function frontmatter(path: string): Record<string, unknown> {
  const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(path, "utf8"));
  if (match?.[1] === undefined) throw new Error(`${path}: no frontmatter`);
  return parse(match[1]) as Record<string, unknown>;
}

const skills = readdirSync(join(REPO_ROOT, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const meta = frontmatter(join(REPO_ROOT, "skills", entry.name, "SKILL.md"));
    return {
      name: typeof meta.name === "string" ? meta.name : entry.name,
      invocable: meta["user-invocable"] !== false,
    };
  })
  .filter((skill) => skill.invocable)
  .map((skill) => skill.name);

const agents = readdirSync(join(REPO_ROOT, "agents"))
  .filter((file) => file.endsWith(".md"))
  .map((file) => {
    const meta = frontmatter(join(REPO_ROOT, "agents", file));
    return typeof meta.name === "string" ? meta.name : file.slice(0, -".md".length);
  });

describe("skills reference", () => {
  const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
  const reference = readPage("reference/skills.md");

  it.each(skills)("/bdk:%s is in README.md and has its section", (name) => {
    expect(readme, "README.md").toContain(`/bdk:${name}`);
    expect(reference.split("\n"), "docs/guide/reference/skills.md").toContain(`## /bdk:${name}`);
  });
});

describe("agents reference", () => {
  const reference = readPage("reference/agents.md");

  it.each(agents)("%s is named in the agents reference", (name) => {
    expect(reference, "docs/guide/reference/agents.md").toContain(name);
  });
});

describe("nav", () => {
  const { docsDir, nav } = readMkdocs();

  it("builds from docs/guide", () => {
    expect(docsDir).toBe("docs/guide");
  });

  it("names exactly the pages under docs/guide", () => {
    expect([...nav].sort()).toStrictEqual(sitePages());
  });
});
