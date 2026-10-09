// The `--json` result of `bdk diagnostics report` (spec `bdk-cli/diagnostics`, "Report output").

import { z } from "zod";

import { DETECTORS } from "../domain/detectors.ts";

const tokens = {
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  cacheRead: z.number().int().nonnegative(),
  cacheWrite5m: z.number().int().nonnegative(),
  cacheWrite1h: z.number().int().nonnegative(),
};

const modelTokens = z.object({
  model: z.string(),
  turns: z.number().int().nonnegative(),
  ...tokens,
});
const usd = z.number().nonnegative().nullable();
const time = z.string().nullable();

export const reportResult = z.object({
  transcripts: z.string(),
  change: z.string().nullable(),
  sessions: z.array(
    z.object({
      id: z.string(),
      file: z.string(),
      start: time,
      end: time,
      wallMs: z.number().int().nonnegative().nullable(),
      cost: z
        .object({ totalUSD: z.number().nonnegative(), byModel: z.record(z.string(), z.number()) })
        .nullable(),
      models: z.array(modelTokens.extend({ costUSD: usd })),
      stages: z.array(
        z.object({
          n: z.number().int().positive(),
          skill: z.string(),
          cite: z.string(),
          start: z.string(),
          end: z.string(),
          wallMs: z.number().int().nonnegative(),
          agents: z.array(z.string()),
          tokens: z.object(tokens),
          costUSD: usd,
        }),
      ),
      agents: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          description: z.string().nullable(),
          parent: z.string().nullable(),
          stage: z.number().int().positive().nullable(),
          file: z.string().nullable(),
          startedBy: z.string().nullable(),
          state: z.enum(["ok", "missing"]),
          start: time,
          end: time,
          wallMs: z.number().int().nonnegative().nullable(),
          turns: z.number().int().nonnegative(),
          toolCalls: z.number().int().nonnegative(),
          errors: z.number().int().nonnegative(),
          models: z.array(modelTokens),
          costUSD: usd,
          unknownLines: z.number().int().nonnegative(),
        }),
      ),
      findings: z.array(
        z.object({
          detector: z.enum(DETECTORS),
          agent: z.string(),
          agentType: z.string(),
          count: z.number().int().positive(),
          summary: z.string(),
          cites: z.array(z.string()),
        }),
      ),
    }),
  ),
  warnings: z.array(z.string()),
});

/** The domain builds the result from read-only values; the JSON document is the same shape. */
type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export type ReportResult = DeepReadonly<z.infer<typeof reportResult>>;
