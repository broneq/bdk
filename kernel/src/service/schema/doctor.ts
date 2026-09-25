// `schema/cli/output/doctor.json`; a contract test keeps the two equal.
import * as z from "zod";

import { versionOutput } from "./version.ts";

const finding = z.object({
  id: z.string(),
  level: z.enum(["ok", "warn", "fail"]),
  summary: z.string(),
  repair: z.string(),
});

export const doctorOutput = z.strictObject({
  ok: z.boolean(),
  version: versionOutput,
  layout: z.enum(["v3", "v2", "none"]).optional(),
  findings: z.array(finding),
});

export type Finding = z.infer<typeof finding>;
export type DoctorOutput = z.infer<typeof doctorOutput>;
