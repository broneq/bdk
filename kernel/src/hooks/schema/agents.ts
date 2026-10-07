// Generates `schema/cli/output/hooks-post-tool.json`, `hooks-subagent-start.json`,
// `hooks-subagent-stop.json` and `hooks-stop.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { PostToolReport, StopReport, SubagentStartReport } from "../domain/report.ts";

const WORKER = "a1b2c3d4e5f6a7b8c";
const agentId = z.string().min(1);

export const postToolOutput = z
  .strictObject({
    tool: z.string().meta({ description: "The payload's tool_name." }),
    linked: z
      .strictObject({
        agent: agentId,
        parent: agentId.meta({ description: "An agent id or `main`." }),
        ticket: z.string().nullable(),
      })
      .nullable()
      .meta({ description: "The child an `Agent` call linked; null otherwise." }),
    ended: z
      .strictObject({ agent: agentId, by: z.enum(["agent-result", "task-stop"]) })
      .nullable()
      .meta({
        description: "The agent a foreground result or a `TaskStop` ended; null otherwise.",
      }),
  })
  .meta({
    title: "bdk hooks post-tool --json",
    description:
      "PostToolUse on Agent and TaskStop: the registry link or end it recorded. Text mode prints nothing.",
    examples: [
      {
        tool: "Agent",
        linked: { agent: WORKER, parent: "main", ticket: "A-9k2m4n6p" },
        ended: null,
      },
    ],
  }) satisfies z.ZodType<PostToolReport>;

export const subagentStartOutput = z
  .strictObject({
    agent: agentId.nullable(),
    parent: agentId.nullable(),
    package: z.string().nullable().meta({ description: "Relative to the project root." }),
    context: z
      .string()
      .nullable()
      .meta({ description: "The BDK-* lines added to a bdk: agent's context; null otherwise." }),
  })
  .meta({
    title: "bdk hooks subagent-start --json",
    description:
      "SubagentStart: the registry row it completed and the identity lines a BDK agent receives.",
    examples: [
      {
        agent: WORKER,
        parent: "main",
        package: ".bdk/changes/2026-09-30-login/dispatch/02-implementer-A-9k2m4n6p.md",
        context: `BDK-AGENT-ID: ${WORKER}\nBDK-PARENT: main\nBDK-PACKAGE: .bdk/changes/2026-09-30-login/dispatch/02-implementer-A-9k2m4n6p.md\nBDK-TICKET: A-9k2m4n6p`,
      },
    ],
  }) satisfies z.ZodType<SubagentStartReport>;

const stopFields = {
  decision: z.enum(["block", "pass"]),
  reason: z
    .string()
    .optional()
    .meta({ description: "On a block: the open work and the next command." }),
  continuations: z.number().int().min(0),
  stalled: z
    .string()
    .optional()
    .meta({ description: "The stall finding written when agents.continuation.max was reached." }),
};

export const stopOutput = z.strictObject(stopFields).meta({
  title: "bdk hooks stop --json",
  description:
    "Stop: the continuation check of the main thread. Text mode prints the host's block object, or nothing on a pass.",
  examples: [
    {
      decision: "block",
      reason:
        "BDK: execute-part:02 is ready (bdk next). Continue it; end your turn only to ask the user a question or to report a blocker.",
      continuations: 1,
    },
  ],
}) satisfies z.ZodType<StopReport>;

export const subagentStopOutput = z
  .strictObject({ agent: agentId.nullable(), ...stopFields })
  .meta({
    title: "bdk hooks subagent-stop --json",
    description:
      "SubagentStop: the continuation check of one agent; a pass ends it. Text mode prints the host's block object, or nothing on a pass.",
    examples: [
      {
        agent: WORKER,
        decision: "block",
        reason:
          "BDK: your report for A-9k2m4n6p is not stored. Write it to its draft and run bdk log ingest --ticket A-9k2m4n6p --file <draft>, then return your envelope.",
        continuations: 1,
      },
    ],
  }) satisfies z.ZodType<StopReport>;
