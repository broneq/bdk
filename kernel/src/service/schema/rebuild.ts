// Generates `schema/cli/output/rebuild.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { RebuildReport } from "../domain/report.ts";

const count = z.int().min(0);

export const rebuildOutput = z
  .strictObject({
    changes: count.meta({ description: "Changes rebuilt." }),
    entries: count.meta({ description: "Ledger entries read." }),
    attempts: count.meta({ description: "Attempt records read." }),
    commits: count.meta({ description: "Commits with BDK trailers read." }),
    migrated: z
      .array(z.string().min(1))
      .meta({ description: "Documents rewritten at the current schema version." }),
    durationMs: count,
    warnings: z.array(z.string().min(1)).meta({
      description:
        "Documents left unchanged (newer than the kernel, or without a migration path) and indexes not regenerated, with the reason.",
    }),
  })
  .meta({
    title: "bdk rebuild --json",
    description:
      "Rebuild the index and the derived progress from committed files and git trailers.",
    examples: [
      {
        changes: 1,
        entries: 38,
        attempts: 6,
        commits: 9,
        migrated: [],
        durationMs: 412,
        warnings: [],
      },
    ],
  }) satisfies z.ZodType<RebuildReport>;
