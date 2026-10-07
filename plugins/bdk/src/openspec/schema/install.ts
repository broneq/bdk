// The `--json` result of `bdk openspec install` (spec `bdk-cli/openspec`, "Install the BDK schema").

import { z } from "zod";

export const InstallResultSchema = z.object({
  schema: z.literal("bdk"),
  /** The installed schema directory, relative to the working directory. */
  target: z.string(),
  /** Every file of the shipped schema, relative to the schema directory, in path order. */
  files: z.array(z.object({ path: z.string(), status: z.enum(["added", "updated", "unchanged"]) })),
});

export type InstallResult = z.infer<typeof InstallResultSchema>;
