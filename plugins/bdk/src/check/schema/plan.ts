// The plan of `bdk check plan`, in `checks/<id>/plan.json` and under `--json` (spec `bdk-cli/check`,
// "Plan the checks").

import { z } from "zod";

import { KINDS, POINTS } from "../domain/plan.ts";

export const checkPlan = z.object({
  version: z.literal(1),
  id: z.string(),
  at: z.enum(POINTS).nullable(),
  changed: z.string().nullable(),
  scope: z.array(z.string()).nullable(),
  tests: z.array(z.string()).nullable(),
  cwd: z.string(),
  checks: z.array(
    z.object({
      kind: z.enum(KINDS),
      tool: z.string(),
      command: z.string(),
      scoped: z.boolean(),
      timeout: z.number().int().positive(),
      "bash-timeout": z.number().int().positive(),
      output: z.string(),
      line: z.string(),
      notes: z.array(z.string()),
    }),
  ),
  skipped: z.array(
    z.object({ kind: z.enum(KINDS), tool: z.string(), reason: z.enum(["paths", "no-files"]) }),
  ),
});

export type CheckPlan = z.infer<typeof checkPlan>;
