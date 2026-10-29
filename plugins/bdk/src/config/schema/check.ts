// The `--json` result of `bdk config check` (ADR-0008).

import { z } from "zod";

import { LayerFileSchema } from "../domain/layer-files.ts";
import { ProblemSchema } from "../domain/validate.ts";

export const CheckResultSchema = z.strictObject({
  root: z.string(),
  layers: z.array(LayerFileSchema),
  problems: z.array(ProblemSchema),
});

export type CheckResult = z.infer<typeof CheckResultSchema>;
