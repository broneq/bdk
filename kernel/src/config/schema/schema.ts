// Generates `schema/cli/output/config-schema.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { SchemaReport } from "../domain/report.ts";

export const configSchemaOutput = z
  .strictObject({
    module: z
      .string()
      .optional()
      .meta({ description: "The module printed; absent for the whole settings schema." }),
    schema: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({ description: "The JSON Schema; absent with --url." }),
    url: z.url().meta({ description: "The versioned URL of the yaml-language-server modeline." }),
    offlineCopy: z
      .string()
      .optional()
      .meta({ description: "The offline copy of the schema, relative to the project root." }),
  })
  .meta({
    title: "bdk config schema --json",
    description:
      "Print the JSON Schema of the settings (the file committed under `schema/`) or of one module.",
    examples: [
      {
        url: "https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json",
        offlineCopy: ".bdk/.machine/schema/settings.json",
      },
    ],
  }) satisfies z.ZodType<SchemaReport>;
