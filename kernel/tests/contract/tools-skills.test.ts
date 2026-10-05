// `tools-skills` (v3-t42-tools): the shape of the tools skills `commit`,
// `docs`, `rules`, `adr`, `doctor` and `bdk-cli` under skills/tools/, the
// removal of the v2 skills they replace, and the kernel commands each names.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { REPO_ROOT } from "../support/run.ts";
import { userFacingFiles, withoutRemovedSection } from "../support/user-facing.ts";

const TOOLS = join(REPO_ROOT, "skills", "tools");
const KERNEL_PAIR = "Bash(bdk *) Bash(echo *)";
const SKILLS = ["commit", "docs", "rules", "adr", "doctor", "bdk-cli"] as const;
const WITH_CONTEXT = ["commit", "docs", "rules", "adr", "doctor"] as const;
const REMOVED = ["add-rule", "refine-rules", "update-docs", "explain-complex-code", "create-adr"];
const MODEL_NAMES = /\b(haiku|sonnet|opus|claude-[a-z0-9-]+)\b/i;

interface Skill {
  readonly meta: Record<string, unknown>;
  readonly body: string;
  readonly lines: number;
}

function readSkill(name: string): Skill {
  const text = readFileSync(join(TOOLS, name, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${name}: no frontmatter`);
  return {
    meta: parse(match[1]) as Record<string, unknown>,
    body: text.slice(match[0].length),
    lines: text.split("\n").length,
  };
}

/** Every file of a directory tree, by path relative to the repository. */
function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

const allowed = (skill: Skill): string => ` ${String(skill.meta["allowed-tools"])} `;

describe("tools skill shape", () => {
  it("every tools skill is in place within 200 lines", () => {
    for (const name of [...SKILLS, "cr", "pr-review"]) {
      expect(existsSync(join(TOOLS, name, "SKILL.md")), name).toBe(true);
    }
    for (const name of SKILLS) expect(readSkill(name).lines, name).toBeLessThanOrEqual(200);
  });

  it("opens with the context lines and grants the kernel pair", () => {
    for (const name of WITH_CONTEXT) {
      const skill = readSkill(name);
      expect(skill.body.trimStart(), name).toMatch(new RegExp(`^!\`bdk ctx skill ${name} `));
      expect(String(skill.meta["allowed-tools"]).startsWith(KERNEL_PAIR), name).toBe(true);
      expect(Object.keys(SKILL_CONTEXT), name).toContain(name);
    }
  });

  it("only doctor is user-only", () => {
    for (const name of SKILLS) {
      const meta = readSkill(name).meta;
      if (name === "doctor") expect(meta["disable-model-invocation"]).toBe(true);
      else expect(meta, name).not.toHaveProperty("disable-model-invocation");
    }
  });

  it("names no foreign plugin, no model and no other namespace", () => {
    for (const name of SKILLS) {
      expect(readSkill(name).meta, name).not.toHaveProperty("model");
      for (const path of files(join(TOOLS, name))) {
        const text = readFileSync(path, "utf8");
        const where = relative(REPO_ROOT, path);
        expect(text, where).not.toMatch(/caveman/i);
        expect(text, where).not.toMatch(MODEL_NAMES);
        expect(text.match(/\/[a-z0-9-]+:[a-z0-9-]+/g) ?? [], where).toStrictEqual(
          (text.match(/\/[a-z0-9-]+:[a-z0-9-]+/g) ?? []).filter((ref) => ref.startsWith("/bdk:")),
        );
      }
    }
  });
});

describe("the v2 tools skills are removed", () => {
  it("no v2 directory remains", () => {
    for (const name of [...REMOVED, "commit"]) {
      expect(existsSync(join(REPO_ROOT, "skills", name)), name).toBe(false);
    }
  });

  it("nothing user-facing names a removed skill", () => {
    const paths = userFacingFiles();
    const stale = new RegExp(`/bdk:(${REMOVED.join("|")})\\b`);
    const hits = paths.filter((path) =>
      stale.test(withoutRemovedSection(readFileSync(path, "utf8"))),
    );
    expect(hits.map((path) => relative(REPO_ROOT, path))).toStrictEqual([]);
  });

  it("the skill-check baseline names no removed or rewritten file", () => {
    const baseline = readFileSync(join(REPO_ROOT, "skill-check.baseline.json"), "utf8");
    for (const name of [...REMOVED, "commit", "tools/commit"]) {
      expect(baseline, name).not.toContain(`skills/${name}/`);
    }
  });
});

describe("commit writes the user's commit", () => {
  const skill = (): Skill => readSkill("commit");

  it("delegates to no other skill", () => {
    expect(skill().meta).not.toHaveProperty("hooks");
    expect(skill().body).not.toContain("skill-exists");
  });

  it("edits nothing and grants only git and the question tool", () => {
    const { meta } = skill();
    expect(meta["disallowed-tools"]).toBe("Edit Write NotebookEdit");
    const tools = allowed(skill());
    for (const tool of [
      "AskUserQuestion",
      "Read",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)",
    ]) {
      expect(tools, tool).toContain(` ${tool} `);
    }
    expect(tools).not.toMatch(/ (Agent|Edit|Write) /);
  });

  it("takes the project's convention and never skips hooks", () => {
    const { body } = skill();
    for (const needle of ["commitlint", "CONTRIBUTING.md", "git log"]) {
      expect(body, needle).toContain(needle);
    }
    expect(body).toMatch(/never[^.]*`--no-verify`/i);
    expect(body).toMatch(/Conventional Commits/);
    expect(body).toMatch(/no co-author/i);
  });

  it("asks which paths to stage when nothing is staged", () => {
    const { body } = skill();
    expect(body).toMatch(/nothing is staged[^.]*ask/i);
    expect(body).toMatch(/never stage[s]? everything unasked/i);
  });

  it("leaves task and review commits to bdk commit", () => {
    const { body } = skill();
    expect(body).toContain("bdk commit");
    expect(body).toMatch(/no BDK trailer/i);
  });
});

describe("docs creates and refreshes architecture documentation", () => {
  const skill = (): Skill => readSkill("docs");

  it("picks the mode from the argument", () => {
    const { body } = skill();
    expect(body).toMatch(/## Refresh/);
    expect(body).toMatch(/## Create/);
    expect(body).toContain("docs/architecture/");
    expect(body).toMatch(/existing Markdown/i);
  });

  it("asks before a refresh writes and keeps the text uniform", () => {
    const { body } = skill();
    const refresh = body.slice(body.indexOf("## Refresh"), body.indexOf("## Create"));
    expect(refresh).toMatch(/AskUserQuestion|ask the user/i);
    expect(refresh).toMatch(/changelog/i);
    expect(refresh).toMatch(/updated on/i);
  });

  it("holds the document shape in one linked reference", () => {
    const { body } = skill();
    expect(existsSync(join(TOOLS, "docs", "references", "document-shape.md"))).toBe(true);
    expect(body).toContain("references/document-shape.md");
    for (const path of files(join(TOOLS, "docs"))) {
      const text = readFileSync(path, "utf8");
      expect(text).not.toContain(".bdk/explain-complex-code");
      expect(text).not.toContain("mermaid-drawer");
    }
  });

  it("drops the v2 Stop hooks", () => {
    expect(skill().meta).not.toHaveProperty("hooks");
  });
});

describe("rules audits, captures and checks rules through the kernel", () => {
  const skill = (): Skill => readSkill("rules");

  it("audits from rules stats and adopts only through rules accept", () => {
    const { body } = skill();
    for (const needle of [
      "bdk rules stats --entries",
      "bdk rules accept",
      "--from",
      "bdk rules prune",
    ]) {
      expect(body, needle).toContain(needle);
    }
    expect(body).toMatch(/nothing is adopted before the user accepts/i);
  });

  it("captures a lesson inside and outside a Change", () => {
    const { body } = skill();
    expect(body).toContain("bdk log add learning");
    expect(body).toContain("--applies");
    expect(body).toMatch(/[Ww]ithout an active Change[^.]*`bdk rules accept`/);
  });

  it("takes the admission test from the rule pack", () => {
    const { body } = skill();
    expect(body).toContain("rules/README.md");
    for (const needle of [
      /fact about the project's own system/,
      /process lesson/,
      /no alternative/,
    ]) {
      expect(body).toMatch(needle);
    }
  });

  it("removes a rule as a tombstone and regenerates the projection", () => {
    const { body } = skill();
    expect(body).toContain("`removed`");
    expect(body).toMatch(/keep[s]? the body/i);
    expect(body).toContain("bdk rules check");
    expect(body).toContain("bdk rules export --claude");
  });

  it("checks with rules check and the projection check", () => {
    const { body } = skill();
    expect(body).toContain("bdk rules export --claude --check");
    expect(SKILL_CONTEXT.rules).toContainEqual({ kind: "fragment", id: "decision" });
  });
});

describe("adr records one decision as MADR", () => {
  const skill = (): Skill => readSkill("adr");

  it("reads a decision entry through the kernel and writes to docs/adr/", () => {
    const { body } = skill();
    expect(body).toContain("bdk log show");
    expect(body).toMatch(/<changeId>\/L-/);
    expect(body).toContain("docs/adr/");
    expect(body).toContain("Rules: architecture");
  });

  it("keeps the MADR template in a linked reference", () => {
    expect(existsSync(join(TOOLS, "adr", "references", "madr-template.md"))).toBe(true);
    expect(skill().body).toContain("references/madr-template.md");
    expect(SKILL_CONTEXT.adr).toContainEqual({ kind: "rules", category: "architecture" });
  });
});

describe("doctor walks the findings of bdk doctor", () => {
  it("fixes first and asks before every system change", () => {
    const { body } = readSkill("doctor");
    expect(body).toContain("bdk doctor --json");
    expect(body).toContain("bdk doctor --fix --json");
    expect(body).toMatch(/system change[^.]*only after the user agrees/i);
  });
});

describe("bdk-cli points to the kernel help", () => {
  it("is a thin front of the bdk CLI", () => {
    const { meta, body, lines } = readSkill("bdk-cli");
    expect((meta.metadata as Record<string, unknown> | undefined)?.["fronts-cli"]).toBe("bdk");
    expect(lines).toBeLessThanOrEqual(30);
    expect(body).toContain("--help");
    expect(body).not.toContain("ctx skill");
  });

  it("names bdk <group> <verb> and no path to the bundle", () => {
    const { meta, body } = readSkill("bdk-cli");
    expect(meta["allowed-tools"]).toBe("Bash(bdk *)");
    expect(body).toContain("bdk <group> <verb>");
    expect(body).not.toContain("bdk.mjs");
    expect(body).not.toContain("CLAUDE_PLUGIN_ROOT");
  });
});
