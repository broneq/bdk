// The event lines of a findings log (spec `bdk-cli/findings`, "Event log"; design D1). The
// fold validates every line against these schemas; the writers build events of these types.
import { z } from "zod";

export const LEVELS = ["blocker", "should-fix", "nice-to-have", "not-a-problem"] as const;
export const DECISIONS = ["fix", "accept", "defer"] as const;

export type Level = (typeof LEVELS)[number];
export type Decision = (typeof DECISIONS)[number];

const text = z.string().min(1);
export const ID = /^f-[0-9a-f]{12}$/;

export const findingEvent = z
  .object({
    type: z.literal("finding"),
    id: z.string().regex(ID),
    source: text,
    summary: text,
    file: text.optional(),
    line: z.int().positive().optional(),
    rule: text.optional(),
    evidence: text.optional(),
  })
  .refine((event) => event.line === undefined || event.file !== undefined, {
    message: "line needs a file",
  });

export const levelEvent = z.object({
  type: z.literal("level"),
  id: z.string().regex(ID),
  level: z.enum(LEVELS),
  reason: text.optional(),
});

export const decisionEvent = z
  .object({
    type: z.literal("decision"),
    id: z.string().regex(ID),
    decision: z.enum(DECISIONS),
    issue: text.optional(),
    reason: text.optional(),
  })
  .refine((event) => (event.decision === "defer") === (event.issue !== undefined), {
    message: "a defer decision needs an issue, other decisions take none",
  });

export const event = z.discriminatedUnion("type", [findingEvent, levelEvent, decisionEvent]);

export type FindingEvent = z.infer<typeof findingEvent>;
export type LevelEvent = z.infer<typeof levelEvent>;
export type DecisionEvent = z.infer<typeof decisionEvent>;
export type Event = z.infer<typeof event>;

/** One event as one log line: compact JSON, fields in a fixed order, a newline at the end. */
export function toLine(event: Event): string {
  return `${JSON.stringify(event)}\n`;
}
