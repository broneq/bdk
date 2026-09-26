// Generates `schema/cli/common/version.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { VersionReport } from "../domain/report.ts";

export const versionOutput = z
  .strictObject({
    kernel: z
      .string()
      .regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
      .meta({
        description:
          "Full kernel semver, the same value the dispatch package frontmatter carries as kernel-version (P10).",
      }),
    contract: z.literal(3).meta({ description: "Contract version: the kernel's major version." }),
    node: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .meta({ description: "The Node.js version running the kernel, without the leading v." }),
  })
  .meta({
    title: "Kernel version",
    description:
      "Output of `bdk version --json` and the version block other outputs embed (contract section 1, design D-7).",
    examples: [{ kernel: "3.0.0", contract: 3, node: "24.21.0" }],
  }) satisfies z.ZodType<VersionReport>;
