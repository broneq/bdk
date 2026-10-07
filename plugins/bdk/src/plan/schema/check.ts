// The `--json` result of `bdk plan check` (spec `bdk-cli/plan`, "Check output").

import { z } from "zod";

import { CHECKS } from "../domain/check.ts";
import { ISOLATIONS } from "../domain/part.ts";

const count = z.number().int().nonnegative();
const id = z.string().regex(/^\d{2}$/);

export const checkResult = z.object({
  ok: z.boolean(),
  limits: z.object({
    maxTasks: z.number().int().positive(),
    maxFiles: z.number().int().positive(),
    maxBytes: z.number().int().positive(),
  }),
  parts: z.array(
    z.object({
      id,
      isolation: z.enum(ISOLATIONS).nullable(),
      dependsOn: z.array(z.string()),
      tasks: count,
      files: count,
      bytes: count,
      wave: z.number().int().positive().nullable(),
    }),
  ),
  waves: z.array(z.object({ wave: z.number().int().positive(), parts: z.array(id).min(1) })),
  problems: z.array(
    z.object({ check: z.enum(CHECKS), parts: z.array(id), message: z.string().min(1) }),
  ),
});

export type CheckResult = z.infer<typeof checkResult>;
