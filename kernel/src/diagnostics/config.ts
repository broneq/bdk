// The settings `diagnostics` reads (`kernel-settings`, Keys of run diagnostics;
// T47-D5): the thresholds of the report's detectors.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

export const repeatRefusalModule = defineConfigModule({
  key: "diagnostics.repeat-refusal",
  consumer: "diagnostics",
  owner: "T47",
  description: "Refusals of one rule in a session that make detector D3 report it.",
  schema: z.int().min(2).max(50).default(3),
});

export const repeatReadModule = defineConfigModule({
  key: "diagnostics.repeat-read",
  consumer: "diagnostics",
  owner: "T47",
  description: "Reads of one file by one agent that make detector D5 report them.",
  schema: z.int().min(2).max(50).default(3),
});

export const outlierFactorModule = defineConfigModule({
  key: "diagnostics.outlier-factor",
  consumer: "diagnostics",
  owner: "T47",
  description:
    "The multiple of the session median above which detector D8 flags a task's tokens or wall time.",
  schema: z.number().min(1.5).max(20).default(3),
});
