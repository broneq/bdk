import { z } from "zod";

import { DECISIONS } from "../domain/events.ts";

/** `bdk findings decide --json`: the finding, its new decision and the issue of a `defer`. */
export const decideResult = z.object({
  id: z.string(),
  decision: z.enum(DECISIONS),
  issue: z.string().optional(),
});

export type DecideResult = z.infer<typeof decideResult>;
