// Generates `schema/cli/output/config-check.json` (kernel/scripts/export-schemas.ts).
// Errors are refusals (design D-8); only warnings reach this shape.
import * as z from "zod";

import type { CheckReport } from "../domain/report.ts";

import { fileLayerName, layerPath } from "./layer.ts";

const WARNING_CODES = ["missing-modeline", "schema-outdated", "legacy-settings"] as const;

export const configCheckOutput = z
  .strictObject({
    problems: z
      .array(
        z.strictObject({
          layer: fileLayerName,
          path: layerPath,
          key: z
            .string()
            .optional()
            .meta({ description: "The dotted key, when the warning concerns one." }),
          code: z.enum(WARNING_CODES),
          message: z.string().min(1),
        }),
      )
      .meta({ description: "Warnings; any error exits 2 with the refusal instead." }),
    snapshot: z.string().optional().meta({
      description:
        "The resolved snapshot written, relative to the project root; absent without .bdk/.",
    }),
    overriddenKeys: z.array(z.string()).meta({
      description: "Sorted dotted keys the global or the local layer sets (D4b).",
    }),
  })
  .meta({
    title: "bdk config check --json",
    description: "Validate every layer against the module schema registry; name unknown keys.",
    examples: [
      {
        problems: [
          {
            layer: "local",
            path: ".bdk/settings.local.yaml",
            code: "missing-modeline",
            message: "no yaml-language-server modeline; bdk doctor --fix adds it",
          },
        ],
        snapshot: ".bdk/.machine/config/resolved.yaml",
        overriddenKeys: ["features.lavish"],
      },
    ],
  }) satisfies z.ZodType<CheckReport>;
