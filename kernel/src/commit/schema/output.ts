// Generates `schema/cli/output/commit.json` (kernel/scripts/export-schemas.ts),
// replacing the hand-written T11 shape.
import * as z from "zod";

import type { CommitReport } from "../domain/report.ts";

const path = z.string().meta({ description: "Path relative to the project root." });

export const commitOutput = z
  .strictObject({
    task: z.string().regex(/^\d{2}-[1-9]\d*$/),
    commit: z
      .string()
      .regex(/^[0-9a-f]{7}$/)
      .meta({ description: "Abbreviated commit." }),
    trailers: z.strictObject({
      "BDK-Change": z.string().min(1),
      "BDK-Part": z.string().regex(/^\d{2}$/),
      "BDK-Task": z.string().regex(/^\d{2}-[1-9]\d*$/),
    }),
    files: z.array(path).meta({ description: "Every path the commit holds." }),
    undeclared: z.array(path).optional().meta({
      description: "Committed files no task declares, recorded in `finding`.",
    }),
    finding: z
      .string()
      .regex(/^L-[0-9a-z]{8}$/)
      .optional()
      .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." }),
  })
  .meta({
    title: "bdk commit --json",
    description:
      "Commit a task: code plus Change directory, with BDK trailers, after the diff check.",
    examples: [
      {
        task: "02-3",
        commit: "d8e4f21",
        trailers: {
          "BDK-Change": "2026-09-25-passwordless-login",
          "BDK-Part": "02",
          "BDK-Task": "02-3",
        },
        files: [
          "src/auth/login.ts",
          "src/auth/login.test.ts",
          ".bdk/changes/2026-09-25-passwordless-login/log/20260925T101502Z-finding-L-e8k2s5vw.md",
        ],
      },
    ],
  }) satisfies z.ZodType<CommitReport>;
