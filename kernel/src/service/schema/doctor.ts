// `schema/cli/output/doctor.json`; a contract test keeps the two equal.
import * as z from "zod";

import type { DoctorReport } from "../domain/report.ts";
import { versionOutput } from "./version.ts";

export const doctorOutput = z.strictObject({
  ok: z.boolean(),
  version: versionOutput,
  layout: z.enum(["v3", "v2", "none"]).optional(),
  findings: z.array(
    z.object({
      id: z.string(),
      level: z.enum(["ok", "warn", "fail"]),
      summary: z.string(),
      repair: z.string(),
    }),
  ),
}) satisfies z.ZodType<DoctorReport>;
