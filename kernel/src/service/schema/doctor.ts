// Generates `schema/cli/output/doctor.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { DoctorReport } from "../domain/report.ts";
import { versionOutput } from "./version.ts";

export const doctorOutput = z
  .strictObject({
    ok: z.boolean(),
    version: versionOutput,
    layout: z.enum(["v3", "v2", "none"]).optional(),
    findings: z.array(
      z.object({
        id: z.string().meta({
          description: "Stable check id, e.g. node-version, v2-layout, merge-hash, index-stale.",
        }),
        level: z.enum(["ok", "warn", "fail"]),
        summary: z.string(),
        repair: z.string().meta({
          description: "Exactly one known repair action (R-14): a command or an install line.",
        }),
      }),
    ),
  })
  .meta({
    title: "bdk doctor --json",
    description:
      "Diagnose the runtime, the layout and the state; one known repair action per finding.",
    examples: [
      {
        ok: false,
        version: { kernel: "3.0.0", contract: 3, node: "22.12.0" },
        layout: "v2",
        findings: [
          {
            id: "node-version",
            level: "fail",
            summary: "Node 22.12.0 is below 22.13.0; node:sqlite needs a flag",
            repair: "nvm install 24 && nvm use 24",
          },
          {
            id: "v2-layout",
            level: "warn",
            summary: ".bdk/settings.json and .bdk/plans/ found",
            repair: "bdk import",
          },
        ],
      },
    ],
  }) satisfies z.ZodType<DoctorReport>;
