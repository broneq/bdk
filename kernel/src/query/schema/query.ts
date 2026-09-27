// Generates `schema/cli/output/query.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { QueryPage } from "../domain/query.ts";

export const queryOutput = z
  .strictObject({
    columns: z.array(z.string()).meta({ description: "Column names in select order." }),
    items: z.array(
      z
        .array(z.union([z.string(), z.number(), z.null()]))
        .meta({ description: "One row as an array of scalars in column order." }),
    ),
    total: z.int().min(0),
    truncated: z.boolean(),
  })
  .meta({
    title: "bdk query --json",
    description: "Read-only SQL over the rebuildable index.",
    examples: [
      {
        columns: ["type", "count(*)"],
        items: [
          ["decision", 4],
          ["finding", 7],
        ],
        total: 2,
        truncated: false,
      },
    ],
  }) satisfies z.ZodType<QueryPage>;
