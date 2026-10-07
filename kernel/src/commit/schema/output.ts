// Generates `schema/cli/output/commit.json` (kernel/scripts/export-schemas.ts),
// replacing the hand-written T11 shape.
import * as z from "zod";

import type { CommitReport, ReviewFixReport } from "../domain/report.ts";

const path = z.string().meta({ description: "Path relative to the project root." });
const commit = z
  .string()
  .regex(/^[0-9a-f]{7}$/)
  .meta({ description: "Abbreviated commit." });
const files = z.array(path).meta({ description: "Every path the commit holds." });

const reviewFixOutput = z
  .strictObject({
    ticket: z
      .string()
      .regex(/^A-[0-9a-z]{8}$/)
      .meta({ description: "The open `review-fix` ticket the fix was made under (T42)." }),
    commit,
    trailers: z.strictObject({
      "BDK-Change": z.string().min(1),
      "BDK-Ticket": z.string().regex(/^A-[0-9a-z]{8}$/),
    }),
    files,
  })
  .meta({ title: "a review fix" }) satisfies z.ZodType<ReviewFixReport>;

export const commitOutput = reviewFixOutput.meta({
  title: "bdk commit --json",
  description:
    "Commit the fix of a review round: code plus Change directory, with BDK trailers, after the diff check.",
  examples: [
    {
      ticket: "A-r2v2w3x4",
      commit: "d8e4f21",
      trailers: {
        "BDK-Change": "2026-09-25-passwordless-login",
        "BDK-Ticket": "A-r2v2w3x4",
      },
      files: [
        "src/auth/login.ts",
        ".bdk/changes/2026-09-25-passwordless-login/log/20260925T101502Z-finding-L-e8k2s5vw.md",
      ],
    },
  ],
}) satisfies z.ZodType<CommitReport>;
