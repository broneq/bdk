import { z } from "zod";

import { listResult } from "./list.ts";

/** `bdk findings report --json`: the path of the written report and the counts of the log. */
export const reportResult = z.strictObject({
  report: z.string(),
  counts: listResult.shape.counts,
});

export type ReportResult = z.infer<typeof reportResult>;
