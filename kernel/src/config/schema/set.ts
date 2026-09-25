// Generates `schema/cli/output/config-set.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { SetReport } from "../domain/report.ts";

import { fileLayerName, layerPath } from "./layer.ts";

export const configSetOutput = z
  .strictObject({
    key: z.string().min(1),
    value: z.unknown().meta({ description: "The value written, parsed from YAML." }),
    previous: z
      .unknown()
      .optional()
      .meta({ description: "The value the layer file held before; absent when it held none." }),
    layer: fileLayerName,
    path: layerPath,
  })
  .meta({
    title: "bdk config set --json",
    description: "Set one key in the project, local or global layer after validating the result.",
    examples: [
      {
        key: "features.lavish",
        value: false,
        previous: true,
        layer: "local",
        path: ".bdk/settings.local.yaml",
      },
    ],
  }) satisfies z.ZodType<SetReport>;
