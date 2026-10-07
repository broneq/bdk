// The result of `bdk check run`, in `checks/<id>.json` and under `--json` (spec `bdk-cli/check`,
// "Result file").

import { z } from "zod";

import { KINDS } from "../domain/plan.ts";
import { STATUSES, VERDICTS } from "../domain/verdict.ts";

export const runResult = z.object({
  version: z.literal(1),
  id: z.string(),
  scope: z.array(z.string()).nullable(),
  verdict: z.enum(VERDICTS),
  checks: z.array(
    z.object({
      kind: z.enum(KINDS),
      tool: z.string(),
      command: z.string(),
      scoped: z.boolean(),
      status: z.enum(STATUSES),
      exit: z.number().int().nullable(),
      timeout: z.number().int().positive(),
      output: z.string(),
      tail: z.array(z.string()).nullable(),
    }),
  ),
  findings: z.object({ log: z.string(), ids: z.array(z.string()) }).nullable(),
});

export type RunResult = z.infer<typeof runResult>;
