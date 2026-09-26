// Generates `schema/cli/output/hooks-session-start.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { SessionStartReport } from "../domain/report.ts";

export const sessionStartOutput = z
  .strictObject({
    content: z.string().meta({
      description: "The STARTUP text followed by one [BDK] line per problem found.",
    }),
    layout: z.enum(["v3", "v2", "none"]).optional().meta({
      description: "The state layout of the project; absent outside a BDK project.",
    }),
    configProblems: z.int().min(0).optional().meta({
      description: "Configuration errors and warnings reported; absent outside a BDK project.",
    }),
  })
  .meta({
    title: "bdk hooks session-start --json",
    description:
      "SessionStart content hook: STARTUP text, configuration check, v2 layout detection, schema refresh.",
    examples: [
      {
        content:
          "# BDK Shared Foundation\n...\n\n[BDK] v2 layout detected (.bdk/settings.json): run bdk import.",
        layout: "v2",
        configProblems: 0,
      },
    ],
  }) satisfies z.ZodType<SessionStartReport>;
