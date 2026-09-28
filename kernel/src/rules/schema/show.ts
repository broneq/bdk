// Generates `schema/cli/output/rules-show.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import { ROLES } from "../../shared/vocabulary/index.ts";
import type { TicketRules } from "../domain/report.ts";

export const rulesShowOutput = z
  .strictObject({
    ticket: z.string().regex(/^A-[0-9a-z]{8}$/),
    role: z.enum(ROLES),
    target: z.string().min(1),
    sections: z
      .array(
        z.strictObject({
          key: z
            .string()
            .regex(/^rules\//)
            .meta({ description: "The prompt key." }),
          file: z.string().meta({
            description:
              "The plugin file of the default, relative to the plugin root; else the lowest file.",
          }),
          layers: z.array(z.enum(["default", "global", "project", "local"])).meta({
            description: "The layers whose files form the value, lowest first.",
          }),
          text: z.string().meta({ description: "The resolved prompt value." }),
        }),
      )
      .meta({ description: "The role's rule categories, then the language rules, in order." }),
    rulesRead: z.iso.datetime().meta({
      description:
        "The `rules-read` stamp of the attempt record: the time of the first call for the ticket.",
    }),
  })
  .meta({
    title: "bdk rules show --json",
    description: "Print one rule by id, or the rules of a ticket.",
    examples: [
      {
        ticket: "A-7f3k9m2q",
        role: "implementer",
        target: "02-3",
        sections: [
          {
            key: "rules/code-quality",
            file: "rules/code-quality.md",
            layers: ["default"],
            text: "# Code Quality Rules\n...",
          },
          {
            key: "rules/languages/typescript",
            file: "rules/languages/typescript.md",
            layers: ["default", "project"],
            text: "# TypeScript\n...",
          },
        ],
        rulesRead: "2026-09-25T10:00:41Z",
      },
    ],
  }) satisfies z.ZodType<TicketRules>;
