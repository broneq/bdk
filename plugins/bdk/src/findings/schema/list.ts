import { z } from "zod";

import { DECISIONS, LEVELS } from "../domain/events.ts";
import type { View } from "../domain/fold.ts";

const count = z.int().nonnegative();

const finding = z.strictObject({
  id: z.string(),
  source: z.string(),
  sources: z.array(z.string()),
  reports: z.int().positive(),
  summary: z.string(),
  file: z.string().optional(),
  line: z.int().positive().optional(),
  rule: z.string().optional(),
  evidence: z.string().optional(),
  level: z.enum(LEVELS).nullable(),
  levelReason: z.string().optional(),
  decision: z.enum(DECISIONS).nullable(),
  issue: z.string().optional(),
  decisionReason: z.string().optional(),
});

/** `bdk findings list --json`: the listed findings, the counts of all and the skipped lines. */
export const listResult = z.strictObject({
  findings: z.array(finding),
  counts: z.strictObject({
    findings: count,
    level: z.strictObject({
      blocker: count,
      "should-fix": count,
      "nice-to-have": count,
      "not-a-problem": count,
      unleveled: count,
    }),
    decision: z.strictObject({ fix: count, accept: count, defer: count, undecided: count }),
  }),
  skipped: z.array(z.strictObject({ line: z.int().positive(), reason: z.string() })),
});

/** The fold's view; the command tests parse every printed result with `listResult`. */
export type ListResult = View;
