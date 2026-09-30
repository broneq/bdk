// Generates `schema/cli/output/ctx.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { ContextReport } from "../domain/report.ts";

export const ctxOutput = z
  .strictObject({
    content: z
      .string()
      .meta({ description: "The composed Markdown, identical to the inject-mode output." }),
    parts: z
      .array(
        z.strictObject({
          kind: z.enum([
            "rules",
            "language-rules",
            "project-rules",
            "fragment",
            "tools",
            "concurrency",
            "file",
            "startup",
            "agents-table",
          ]),
          source: z.string().meta({
            description:
              "The rule directory (rules/security, .bdk/rules), prompt key (fragments/decision/lavish), tools group (tools.test), settings key (execution.concurrency) or plugin path that produced the part.",
          }),
        }),
      )
      .meta({ description: "The parts of the content, in output order." }),
  })
  .meta({
    title: "bdk ctx skill|startup --json",
    description:
      "The prompt context of a skill or the STARTUP instructions; an error is the refusal object, still with exit 0.",
    examples: [
      {
        content: "## BDK context: design\n\n### Rules: architecture\n...",
        parts: [
          { kind: "rules", source: "rules/architecture" },
          { kind: "rules", source: "rules/engineering-judgment" },
          { kind: "fragment", source: "fragments/decision/ask-user" },
        ],
      },
    ],
  }) satisfies z.ZodType<ContextReport>;
