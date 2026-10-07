// The `--json` result of `bdk git scope` (spec `bdk-cli/git`, "Scope of a review round").

import { z } from "zod";

const paths = z.array(z.string());

export const scopeSchema = z.strictObject({
  base: z.string(),
  anchor: z.strictObject({
    kind: z.enum(["base", "round"]),
    sha: z.string(),
    round: z.number().int().positive().optional(),
    fallback: z.string().optional(),
  }),
  head: z.string(),
  range: z.string(),
  files: paths,
  binary: paths,
  deleted: paths,
  dirty: paths,
});

export type ScopeResult = z.infer<typeof scopeSchema>;
