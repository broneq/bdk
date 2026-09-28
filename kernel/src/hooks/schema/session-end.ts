// Generates `schema/cli/output/hooks-session-end.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { SessionEndReport } from "../domain/report.ts";

export const sessionEndOutput = z
  .strictObject({
    content: z.string().meta({
      description: "Empty, or the one [BDK] checkpoint line after a commit.",
    }),
    reason: z.string().optional().meta({ description: "The host's SessionEnd reason." }),
    checkpoint: z.strictObject({
      done: z.boolean(),
      commit: z
        .string()
        .regex(/^[0-9a-f]{7}$/)
        .optional()
        .meta({ description: "The short checkpoint commit." }),
      skipped: z.string().min(1).optional().meta({
        description:
          "Why no commit was made: no active Change, the policy, nothing changed, a git operation in progress, open tickets or a failing git hook.",
      }),
    }),
  })
  .meta({
    title: "bdk hooks session-end --json",
    description:
      "SessionEnd content hook: Change checkpoint commit when enabled and safe; every other outcome is reported as skipped.",
    examples: [
      {
        content: "",
        reason: "prompt_input_exit",
        checkpoint: {
          done: false,
          skipped: "ticket A-7f3k9m2q is open; a subagent may still be writing",
        },
      },
      {
        content: "[BDK] checkpoint 3f9c2e1 of 2026-09-25-login",
        reason: "clear",
        checkpoint: { done: true, commit: "3f9c2e1" },
      },
    ],
  }) satisfies z.ZodType<SessionEndReport>;
