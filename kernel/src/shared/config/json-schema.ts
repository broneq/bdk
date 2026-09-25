// The JSON Schema of the settings files (`kernel-settings`, Settings JSON
// Schema; design D-10), generated from the registry so the IDE and the kernel
// check the same keys. `kernel/scripts/export-schemas.ts` commits it.
import * as z from "zod";

import type { ConfigRegistry } from "./registry.ts";

export const SETTINGS_SCHEMA_ID =
  "https://raw.githubusercontent.com/broneq/bdk/v3/schema/settings.json";

/** Throws when a module's schema has no JSON Schema form, so the build fails instead of the IDE. */
export function settingsJsonSchema(registry: ConfigRegistry): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(registry.schema, {
    target: "draft-2020-12",
    io: "input",
    unrepresentable: "throw",
  });
  return {
    $schema,
    $id: SETTINGS_SCHEMA_ID,
    title: "BDK settings",
    description:
      "One layer of the BDK settings: ~/.config/bdk/settings.yaml, .bdk/settings.yaml or .bdk/settings.local.yaml.",
    ...rest,
  };
}
