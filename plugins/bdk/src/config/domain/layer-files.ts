// The layer files of a project (spec `bdk-cli/config`, "Layer files"): where each one is, and
// whether it exists.

import { z } from "zod";

export const LayerFileSchema = z.strictObject({
  layer: z.enum(["global", "project", "local"]),
  path: z.string(),
  present: z.boolean(),
});

export type LayerFile = z.infer<typeof LayerFileSchema>;

export type FileLayerName = LayerFile["layer"];
