// `plugin-tooling`, Skill context lines (design D-10 of
// v3-t13-ctx-content-hooks): every skill asks for its context the same way.
// The two line forms are read from the `kernel-cli` spec, so changing the
// form there fails every skill that was not updated.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import type { Part } from "../../src/ctx/use-cases/manifest.ts";
import { settingsRegistry } from "../../src/registrations.ts";
import { REPO_ROOT } from "../support/run.ts";
import { contextLineViolations, manifestViolations } from "../support/skill-context.ts";
import type { ContextLineForms, SkillFile } from "../support/skill-context.ts";

const CORE_SPEC = join(REPO_ROOT, "openspec", "specs", "kernel-cli", "spec.md");

function regexBlock(spec: string, info: string): RegExp {
  const match = new RegExp("^```regex " + info + "\\s*\\n([\\s\\S]*?)^```", "m").exec(spec);
  if (match?.[1] === undefined) throw new Error(`no \`regex ${info}\` block in ${CORE_SPEC}`);
  return new RegExp(match[1].trim());
}

const spec = readFileSync(CORE_SPEC, "utf8");
const forms: ContextLineForms = {
  wrapper: regexBlock(spec, "content-wrapper"),
  fallback: regexBlock(spec, "content-fallback"),
};

const skills: SkillFile[] = readdirSync(join(REPO_ROOT, "skills"), { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && existsSync(join(REPO_ROOT, "skills", entry.name, "SKILL.md")),
  )
  .map((entry) => ({
    name: entry.name,
    text: readFileSync(join(REPO_ROOT, "skills", entry.name, "SKILL.md"), "utf8"),
  }));

const registry = settingsRegistry();

/** The plugin files a part reads; undefined for a prompt key ctx does not declare. */
function partFiles(part: Part): (string | undefined)[] {
  switch (part.kind) {
    case "rules":
      return [registry.promptKey(`rules/${part.category}`)?.defaultFile];
    case "fragment":
      return ["lavish", "ask-user"].map(
        (id) => registry.promptKey(`fragments/decision/${id}`)?.defaultFile,
      );
    case "language-rules":
      return [
        registry.prompts.some((prompt) => prompt.key === "rules/languages/*")
          ? "rules/languages"
          : undefined,
      ];
    case "file":
      return [part.path];
    case "tools":
      return [];
  }
}

const WRAPPER = (name: string) =>
  `!\`node "\${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill ${name} 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."\``;
const FALLBACK = (name: string) =>
  `If no "BDK context: ${name}" heading appears above, run \`node "\${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill ${name}\` first and apply its output; on a \`BDK STOP\` line, stop and report it.`;
const skill = (name: string, ...body: string[]): SkillFile => ({
  name,
  text: `---\nname: ${name}\ndescription: x\n---\n\n${body.join("\n\n")}\n`,
});

describe("skill context lines", () => {
  const check = contextLineViolations(skills, forms);

  it("every skill that asks for context uses the two lines with its own name", () => {
    expect(check.violations).toStrictEqual([]);
  });

  it("the skills with context lines are exactly the manifest entries", () => {
    expect(manifestViolations(check.withLines, Object.keys(SKILL_CONTEXT))).toStrictEqual([]);
  });

  it("every part of every manifest entry resolves", () => {
    const problems: string[] = [];
    for (const [name, parts] of Object.entries(SKILL_CONTEXT)) {
      for (const part of parts) {
        for (const file of partFiles(part)) {
          if (file === undefined || !existsSync(join(REPO_ROOT, file))) {
            problems.push(
              `${name}: ${part.kind} part does not resolve (${file ?? "undeclared key"})`,
            );
          }
        }
      }
    }
    expect(problems).toStrictEqual([]);
  });

  describe("negative controls", () => {
    it("fails on a skill without the fallback sentence", () => {
      const seeded = contextLineViolations([skill("debug", WRAPPER("debug"), "Body.")], forms);
      expect(seeded.violations).toStrictEqual([
        "debug: the second body line is not the fallback sentence",
      ]);
    });

    it("fails on lines that name another skill", () => {
      const seeded = contextLineViolations(
        [skill("design", WRAPPER("create-plan"), FALLBACK("create-plan"))],
        forms,
      );
      expect(seeded.violations).toStrictEqual([
        "design: the content wrapper names create-plan, not design",
        "design: the fallback sentence names create-plan, not design",
      ]);
    });

    it("fails on an inject script, a cat block or a second kernel block", () => {
      const seeded = contextLineViolations(
        [
          skill(
            "cr",
            WRAPPER("cr"),
            FALLBACK("cr"),
            "!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if x --then y`",
            "!`cat ${CLAUDE_PLUGIN_ROOT}/skills/cr/references/a.md`",
            WRAPPER("cr"),
          ),
        ],
        forms,
      );
      expect(seeded.violations).toHaveLength(3);
    });

    it("fails when the manifest and the skills disagree", () => {
      expect(manifestViolations(["design", "extra"], ["design", "missing"])).toStrictEqual([
        "missing: a manifest entry, but its SKILL.md has no context lines",
        "extra: context lines, but no manifest entry",
      ]);
    });

    it("fails once for every skill when the fallback form changes", () => {
      const changed: ContextLineForms = { ...forms, fallback: /^Load the context of ([a-z-]+)\.$/ };
      const seeded = contextLineViolations(
        [skill("a", WRAPPER("a"), FALLBACK("a")), skill("b", WRAPPER("b"), FALLBACK("b"))],
        changed,
      );
      expect(seeded.violations).toStrictEqual([
        "a: the second body line is not the fallback sentence",
        "b: the second body line is not the fallback sentence",
      ]);
    });

    it("passes the two lines themselves", () => {
      expect(contextLineViolations([skill("x", WRAPPER("x"), FALLBACK("x"))], forms)).toStrictEqual(
        {
          violations: [],
          withLines: ["x"],
        },
      );
    });
  });
});
