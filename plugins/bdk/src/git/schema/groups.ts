// The `--json` result of `bdk git groups`, also the round record `groups.json`
// (`docs/concepts/run-state.md`).

import { z } from "zod";

import { scopeSchema } from "./scope.ts";

export const groupsSchema = scopeSchema.extend({
  groups: z.array(
    z.strictObject({
      id: z.string(),
      kind: z.enum(["part", "unplanned", "module", "integration"]),
      part: z.string().optional(),
      files: z.array(z.string()),
    }),
  ),
});

export type GroupsResult = z.infer<typeof groupsSchema>;
