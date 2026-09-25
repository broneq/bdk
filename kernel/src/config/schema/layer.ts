// The layer names as the outputs spell them (`kernel-settings`, Configuration layers).
import * as z from "zod";

export const layerName = z.enum(["default", "global", "project", "local"]);

export const fileLayerName = z.enum(["global", "project", "local"]);

export const layerPath = z.string().min(1).meta({
  description: "The layer file: relative to the project root, absolute for the global layer.",
});
