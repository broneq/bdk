// Generates `schema/cli/output/config-show.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { ShowReport } from "../domain/report.ts";

import { fileLayerName, layerName, layerPath } from "./layer.ts";

export const configShowOutput = z
  .strictObject({
    key: z
      .string()
      .optional()
      .meta({ description: "The requested dotted key; absent for the whole tree." }),
    value: z.unknown().meta({
      description:
        "The resolved value or subtree; a prompt value is its effective mode and contributing files.",
    }),
    origins: z
      .record(z.string(), layerName)
      .optional()
      .meta({ description: "Dotted leaf key -> the layer it came from, with --origins." }),
    layers: z
      .array(z.strictObject({ layer: fileLayerName, path: layerPath, present: z.boolean() }))
      .meta({ description: "Every file layer, lowest first, and whether its file exists." }),
  })
  .meta({
    title: "bdk config show --json",
    description: "The resolved configuration after the four layers, with the origin of every key.",
    examples: [
      {
        key: "tools.test",
        value: [
          {
            id: "unit",
            tier: "fast",
            command: "pnpm test:unit",
            scoped: "pnpm vitest run {files}",
          },
        ],
        origins: {
          "tools.test.unit.tier": "project",
          "tools.test.unit.command": "project",
          "tools.test.unit.scoped": "local",
        },
        layers: [
          { layer: "global", path: "/home/dev/.config/bdk/settings.yaml", present: false },
          { layer: "project", path: ".bdk/settings.yaml", present: true },
          { layer: "local", path: ".bdk/settings.local.yaml", present: true },
        ],
      },
    ],
  }) satisfies z.ZodType<ShowReport>;
