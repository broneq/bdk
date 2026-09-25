// `schema/cli/common/version.json`; a contract test keeps the two equal.
import * as z from "zod";

import type { VersionReport } from "../domain/report.ts";

export const versionOutput = z.strictObject({
  kernel: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/),
  contract: z.literal(3),
  node: z.string().regex(/^\d+\.\d+\.\d+$/),
}) satisfies z.ZodType<VersionReport>;
