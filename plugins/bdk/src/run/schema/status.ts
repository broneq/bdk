// The `--json` result of `bdk run status` (spec `bdk-cli/run`, "Run status output").

import { z } from "zod";

import { MODES, PART_STATUSES, STAGES, STEPS } from "../domain/status.ts";

export const statusResult = z.object({
  mode: z.enum(MODES),
  current: z.string(),
  changes: z.array(
    z.object({
      change: z.string(),
      issue: z.number().int().positive().nullable(),
      current: z.boolean(),
      stage: z.enum(STAGES),
      step: z.enum(STEPS).nullable(),
      row: z.number().int().min(1).max(9).nullable(),
      round: z.number().int().positive().nullable(),
      reason: z.string(),
    }),
  ),
  parts: z.array(
    z.object({
      id: z.string(),
      status: z.enum(PART_STATUSES),
      attempts: z.number().int().nonnegative(),
      reason: z.string().nullable(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type StatusResult = z.infer<typeof statusResult>;
