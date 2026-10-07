import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.ts";
import type { Finding } from "../index.ts";
import { runChecks } from "../runner.ts";
import { skill, tree } from "../test-helpers.ts";

// Structure rules read the skill directory, so they run end to end on a tree.
async function findings(
  rule: string,
  files: Record<string, string>,
  setting = `"error"`,
): Promise<Finding[]> {
  const only = `{ ${["references", "unused-files", "layout", "unique-names"].map((id) => `"${id}": ${id === rule ? setting : `"off"`}`).join(", ")} }`;
  const root = tree({
    "skill-check.config.mjs": `
      const off = ["frontmatter","name-format","name-matches-dir","skill-file-name","description","description-front-loaded","fields","field-values","invocation","require-model","body","line-limit","absolute-paths","model-names","arguments-typo","cli-front"];
      export default {
        targets: [{ kind: "skills", dirs: ["skills"] }, { kind: "skills", dirs: ["more"], name: "more" }],
        rules: { ...Object.fromEntries(off.map((id) => [id, "off"])), ...${only} },
      };`,
    "more/.keep": "",
    ...files,
  });
  return runChecks(await loadConfig(root), { cwd: root, paths: [] }).findings;
}

const brief = (list: Finding[]) => list.map((f) => [f.severity, f.file, f.line, f.message]);

describe("references", () => {
  it("passes links and backticked paths that resolve", async () => {
    const out = await findings("references", {
      "skills/demo/SKILL.md": skill(
        "demo",
        "",
        "See [guide](references/guide.md#top) and `scripts/run.sh`.\nRun `${CLAUDE_SKILL_DIR}/scripts/run.sh`.\nIgnore `src/app.ts`, [site](https://x.dev) and [up](../other/SKILL.md).\n",
      ),
      "skills/demo/references/guide.md": "# Guide\n",
      "skills/demo/scripts/run.sh": "echo\n",
    });
    expect(out).toEqual([]);
  });

  it("reports a link that does not resolve", async () => {
    const out = await findings("references", {
      "skills/demo/SKILL.md": skill("demo", "", "See [guide](references/missing.md).\n"),
    });
    expect(brief(out)).toEqual([
      [
        "error",
        "skills/demo/SKILL.md",
        6,
        "`references/missing.md` does not exist in the skill directory",
      ],
    ]);
  });

  it("warns on a referenced file that links on to another file", async () => {
    const out = await findings("references", {
      "skills/demo/SKILL.md": skill("demo", "", "See [a](references/a.md).\n"),
      "skills/demo/references/a.md": "# A\n\nThen [b](references/b.md).\n",
      "skills/demo/references/b.md": "# B\n",
    });
    expect(brief(out)).toEqual([
      [
        "warning",
        "skills/demo/references/a.md",
        3,
        "`references/a.md` links on to `references/b.md`; link it from SKILL.md to keep references one level deep",
      ],
    ]);
  });

  it("does not warn when SKILL.md links the second file itself", async () => {
    const out = await findings("references", {
      "skills/demo/SKILL.md": skill(
        "demo",
        "",
        "See [a](references/a.md) and [b](references/b.md).\n",
      ),
      "skills/demo/references/a.md": "Then [b](references/b.md).\n",
      "skills/demo/references/b.md": "# B\n",
    });
    expect(out).toEqual([]);
  });

  it("does not warn when a referenced file names a directory", async () => {
    const out = await findings("references", {
      "skills/demo/SKILL.md": skill("demo", "", "See [a](references/a.md).\n"),
      "skills/demo/references/a.md": "Files live in `references/`.\n",
    });
    expect(out).toEqual([]);
  });

  it("ignores backticked paths inside code fences", async () => {
    const out = await findings("references", {
      "skills/demo/SKILL.md": skill("demo", "", "```\n`references/nope.md`\n```\n"),
    });
    expect(out).toEqual([]);
  });
});

describe("unused-files", () => {
  it("passes files referenced from SKILL.md or one level down", async () => {
    const out = await findings("unused-files", {
      "skills/demo/SKILL.md": skill(
        "demo",
        "",
        "Read references/a.md.\n\n```sh\nbash ${CLAUDE_SKILL_DIR}/scripts/run.sh\n```\n",
      ),
      "skills/demo/references/a.md": "Use assets/template.txt.\n",
      "skills/demo/assets/template.txt": "x\n",
      "skills/demo/scripts/run.sh": "echo\n",
    });
    expect(out).toEqual([]);
  });

  it("reports a file nothing references", async () => {
    const out = await findings("unused-files", {
      "skills/demo/SKILL.md": skill("demo"),
      "skills/demo/references/old.md": "# Old\n",
    });
    expect(brief(out)).toEqual([
      [
        "error",
        "skills/demo/references/old.md",
        1,
        "`references/old.md` is not referenced from SKILL.md or a file it references",
      ],
    ]);
  });
});

describe("layout", () => {
  it("allows anything by default", async () => {
    const out = await findings("layout", {
      "skills/demo/SKILL.md": skill("demo"),
      "skills/demo/misc/x.md": "x\n",
    });
    expect(out).toEqual([]);
  });

  it("reports entries outside the allowed list", async () => {
    const out = await findings(
      "layout",
      {
        "skills/demo/SKILL.md": skill("demo"),
        "skills/demo/references/a.md": "x\n",
        "skills/demo/misc/x.md": "x\n",
        "skills/demo/misc/y.md": "x\n",
        "skills/demo/NOTES.md": "x\n",
      },
      `["error", { allowed: ["references"] }]`,
    );
    expect(brief(out)).toEqual([
      [
        "error",
        "skills/demo/misc",
        1,
        "`misc/` is not an allowed top-level entry of a skill (allowed: references)",
      ],
      [
        "error",
        "skills/demo/NOTES.md",
        1,
        "`NOTES.md` is not an allowed top-level entry of a skill (allowed: references)",
      ],
    ]);
  });
});

describe("unique-names", () => {
  it("reports the same name in two targets", async () => {
    const out = await findings("unique-names", {
      "skills/review/SKILL.md": skill("review"),
      "more/review/SKILL.md": skill("review"),
      "skills/other/SKILL.md": skill("other"),
    });
    expect(brief(out)).toEqual([
      [
        "error",
        "more/review/SKILL.md",
        2,
        "skill name `review` is also used by skills/review/SKILL.md",
      ],
      [
        "error",
        "skills/review/SKILL.md",
        2,
        "skill name `review` is also used by more/review/SKILL.md",
      ],
    ]);
  });
});
