// The `--json` result of `bdk config set` (spec `bdk-cli/config`, "config set").

import { z } from "zod";

export const SetResultSchema = z.strictObject({
  key: z.string(),
  value: z.unknown(),
  layer: z.enum(["global", "project", "local"]),
  file: z.string(),
});

export type SetResult = z.infer<typeof SetResultSchema>;
