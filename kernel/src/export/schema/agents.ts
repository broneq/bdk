// Generates `schema/cli/output/export-agents.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { AgentsReport } from "../domain/report.ts";

export const exportAgentsOutput = z
  .strictObject({
    host: z.string().meta({ description: "The host the files were generated for." }),
    files: z.array(
      z.strictObject({
        adapter: z.enum([
          "worker",
          "reader",
          "integrator",
          "judge",
          "reviewer",
          "runner",
          "scout",
          "lead",
        ]),
        path: z.string().meta({ description: "Path relative to the project root." }),
        changed: z.boolean().meta({
          description: "Written by this run, or found different under --check.",
        }),
      }),
    ),
    changed: z.boolean().meta({ description: "True when any file changed." }),
  })
  .meta({
    title: "bdk export agents --json",
    description:
      "Generate a host's adapter files from the kernel's adapter definitions and the per-host tool map.",
    examples: [
      {
        host: "claude",
        files: [{ adapter: "worker", path: "agents/worker.md", changed: false }],
        changed: false,
      },
    ],
  }) satisfies z.ZodType<AgentsReport>;
