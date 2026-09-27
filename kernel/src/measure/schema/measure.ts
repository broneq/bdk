// Generates `schema/cli/output/measure.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { MeasureReport } from "../domain/measure.ts";

const count = z.int().min(0);

export const measureOutput = z
  .strictObject({
    range: z.string().min(1).meta({ description: "The measured range, `HEAD` by default." }),
    files: count.meta({ description: "Changed files, `.bdk/` excluded." }),
    added: count,
    removed: count,
    lines: count.meta({ description: "added + removed; a binary file counts zero lines." }),
    modules: z.array(z.string().min(1)).meta({
      description: "Distinct first two directory segments (the file name for a root file), sorted.",
    }),
  })
  .meta({
    title: "bdk measure --json",
    description:
      "Measure a git diff: changed files, lines and modules, as raw signals for the caller's own classification.",
    examples: [
      {
        range: "main",
        files: 6,
        added: 180,
        removed: 42,
        lines: 222,
        modules: ["src/auth", "src/mail"],
      },
    ],
  }) satisfies z.ZodType<MeasureReport>;
