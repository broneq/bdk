// The `--json` result of `bdk hooks session-start -` (spec `bdk-cli/hooks`, "Hook output").

import { z } from "zod";

export const sessionStartResult = z.object({
  status: z.enum(["ok", "not-configured", "invalid"]),
  root: z.string(),
  /** What the model gets; null when the user gets the warning instead. */
  context: z.string().nullable(),
  warning: z.string().nullable(),
});

export type SessionStartResult = z.infer<typeof sessionStartResult>;
