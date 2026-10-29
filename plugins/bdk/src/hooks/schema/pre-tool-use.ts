// The `--json` result of `bdk hooks pre-tool-use -` (`docs/concepts/cli-config-hooks.md`).

import { z } from "zod";

export const preToolUseResult = z.object({
  decision: z.enum(["allow", "deny"]),
  /** The `git <subcommand>` the guard matched; null on allow. */
  command: z.string().nullable(),
  reason: z.string().nullable(),
});

export type PreToolUseResult = z.infer<typeof preToolUseResult>;
