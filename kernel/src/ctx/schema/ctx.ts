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
            "fragment",
            "tools",
            "concurrency",
            "verifier-policy",
            "file",
            "startup",
            "agents-table",
            "craft",
          ]),
          source: z.string().meta({
            description:
              "The stage of a rules part (stage:design, stage:plan), prompt key (fragments/decision/lavish), tools group (tools.test), settings key (execution.concurrency, policy.verifier) plugin path, or `bdk-craft/<name>` of a craft skill, that produced the part.",
          }),
        }),
      )
      .meta({ description: "The parts of the content, in output order." }),
  })
  .meta({
    title: "bdk ctx skill|startup|craft --json",
    description:
      "The prompt context of a skill, the STARTUP instructions or a craft skill; an error of `ctx skill` is the refusal object, still with exit 0.",
    examples: [
      {
        content: "## BDK context: design\n\n### Rules\n...",
        parts: [
          { kind: "rules", source: "stage:design" },
          { kind: "fragment", source: "fragments/decision/ask-user" },
        ],
      },
    ],
  }) satisfies z.ZodType<ContextReport>;
