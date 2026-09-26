// Generates `schema/cli/output/hooks-skill-exists.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { SkillExistsReport } from "../domain/report.ts";

export const skillExistsOutput = z
  .strictObject({
    name: z.string().meta({ description: "The skill name asked for." }),
    installed: z.boolean(),
    foundIn: z.string().optional().meta({
      description:
        "The SKILL.md whose frontmatter name matched, under ~/.claude/skills, the project's .claude/skills, a marketplace or an installed plugin version.",
    }),
    content: z.string().meta({ description: "Empty when installed, else the one [BDK] line." }),
  })
  .meta({
    title: "bdk hooks skill-exists --json",
    description:
      "Skill-frontmatter UserPromptSubmit hook: warn as content when a named skill is not installed.",
    examples: [
      {
        name: "caveman-commit",
        installed: false,
        content:
          "[BDK] skill caveman-commit is not installed; the skill that needs it falls back to its own behaviour.",
      },
    ],
  }) satisfies z.ZodType<SkillExistsReport>;
