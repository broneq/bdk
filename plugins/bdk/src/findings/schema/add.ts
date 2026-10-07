import { z } from "zod";

/** `bdk findings add --json`: the id of the finding. */
export const addResult = z.object({ id: z.string() });

export type AddResult = z.infer<typeof addResult>;
