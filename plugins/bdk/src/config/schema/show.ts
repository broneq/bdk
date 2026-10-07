// The `--json` result of `bdk config show` (spec `bdk-cli/config`, "config show").

import { z } from "zod";

import { LayerFileSchema } from "../domain/layer-files.ts";
import { LayerNameSchema } from "../domain/merge.ts";
import { ProblemSchema } from "../domain/validate.ts";

export const EntrySchema = z.strictObject({
  key: z.string(),
  value: z.unknown(),
  origin: LayerNameSchema,
});

export const ShowResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ok"),
    root: z.string(),
    layers: z.array(LayerFileSchema),
    /** Absent when the whole configuration is shown. */
    key: z.string().optional(),
    entries: z.array(EntrySchema),
  }),
  z.strictObject({
    status: z.literal("not-configured"),
    root: z.string(),
    missing: z.array(z.enum(["settings", "openspec"])),
  }),
  z.strictObject({
    status: z.literal("invalid"),
    root: z.string(),
    layers: z.array(LayerFileSchema),
    problems: z.array(ProblemSchema),
  }),
]);

export type ShowResult = z.infer<typeof ShowResultSchema>;
