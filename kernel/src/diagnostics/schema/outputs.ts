// Generates `schema/cli/output/diagnostics-{report,log,slice,write}.json`
// (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { DiagnosticsReport, LogReport, SliceReport, WriteReport } from "../domain/report.ts";
import { DETECTORS, TRANSCRIPT_STATES } from "../domain/report.ts";

const timestamp = z.iso.datetime().meta({ description: "ISO 8601 UTC." });
const count = z.int().min(0);
const transcript = z.enum(TRANSCRIPT_STATES).meta({
  description:
    "ok; missing (a named transcript file is gone); unreadable (over 10% of its lines have an unknown shape); unavailable (the host gave no transcript path).",
});
const modelTokens = z.strictObject({
  input: count,
  output: count,
  cacheRead: count,
  cacheWrite: count,
});
const tokens = z
  .record(z.string(), modelTokens)
  .nullable()
  .meta({ description: "Tokens per model id; null when a transcript it needs is not ok." });
const examplePath =
  ".bdk/.machine/logs/2026-10-05-italian-5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11.log";

export const diagnosticsReportOutput = z
  .strictObject({
    session: z.string().min(1),
    change: z.string().nullable(),
    stage: z.string().nullable(),
    from: timestamp,
    to: timestamp,
    transcript,
    unknownLines: count,
    truncated: z
      .boolean()
      .meta({ description: "The journal no longer holds the session's first line." }),
    refusals: z.strictObject({
      total: count,
      byRule: z.record(z.string(), count),
      byRole: z.record(z.string(), count),
    }),
    guardBlocks: count,
    retries: count.meta({ description: "Tickets after the first on one target." }),
    escalations: count,
    parks: count,
    questions: count,
    agents: z.array(
      z.strictObject({
        agent: z.string().min(1),
        type: z.string().min(1),
        role: z.string().nullable(),
        wallMs: count.nullable(),
        tokens,
      }),
    ),
    tasks: z.array(
      z.strictObject({
        task: z.string().min(1),
        part: z.string().min(1),
        tickets: count,
        wallMs: count,
        tokens,
      }),
    ),
    parts: z.array(z.strictObject({ part: z.string().min(1), wallMs: count, tokens })),
    tokensUnknownAgents: count.meta({
      description: "Agents that ended without SubagentStop or whose transcript is not ok.",
    }),
    cost: z
      .strictObject({ totalUSD: z.number().min(0), byModel: z.record(z.string(), z.number()) })
      .nullable()
      .meta({
        description:
          "The whole session's USD cost from the host transcript's cost-state line; null without one.",
      }),
    findings: z.array(
      z.strictObject({
        detector: z.enum(DETECTORS),
        agent: z.string().min(1),
        ticket: z.string().nullable(),
        at: timestamp,
        cite: z.string().min(1),
        summary: z.string().min(1).meta({ description: "Never quotes tool output." }),
      }),
    ),
    anomalies: count,
  })
  .meta({
    title: "bdk diagnostics report --json",
    description: "The deterministic report of one session (kernel-cli/diagnostics).",
  }) satisfies z.ZodType<DiagnosticsReport>;

export const diagnosticsLogOutput = z
  .strictObject({ path: z.string().min(1), lines: count, transcript })
  .meta({
    title: "bdk diagnostics log --json",
    description: "The verbose render of one session.",
    examples: [{ path: examplePath, lines: 1840, transcript: "ok" }],
  }) satisfies z.ZodType<LogReport>;

export const diagnosticsSliceOutput = z
  .strictObject({
    agent: z.string().min(1),
    at: timestamp,
    events: z.array(z.string()),
    omitted: count.meta({ description: "Lines left out past the 200-line cap." }),
  })
  .meta({
    title: "bdk diagnostics slice --json",
    description: "One bounded excerpt of a session's transcript.",
  }) satisfies z.ZodType<SliceReport>;

export const diagnosticsWriteOutput = z.strictObject({ path: z.string().min(1) }).meta({
  title: "bdk diagnostics write --json",
  description: "Where the analysis of the session was stored.",
}) satisfies z.ZodType<WriteReport>;
