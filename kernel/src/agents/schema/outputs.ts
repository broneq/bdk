// Generates `schema/cli/output/agents-{list,show,wait}.json`
// (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type {
  AgentItem,
  AgentsListReport,
  AgentsShowReport,
  AgentsWaitReport,
  WaitEvent,
} from "../domain/reports.ts";
import { AGENT_STATES } from "../domain/state.ts";

const timestamp = z.iso
  .datetime({ precision: 3 })
  .meta({ description: "ISO 8601 UTC with milliseconds." });
const agentId = z.string().min(1).meta({ description: "The host's agent id, or `main`." });
const ticketId = z
  .string()
  .regex(/^A-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const entryId = z
  .string()
  .regex(/^L-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const state = z.enum(AGENT_STATES).meta({
  description: "Derived at the time of the call (`kernel-state`, Agent registry).",
});
const endSignal = z.enum(["subagent-stop", "task-stop", "agent-result", "stale"]);
const count = z.int().min(0);

const itemShape = {
  id: agentId,
  type: z.string().nullable().meta({ description: "The host's `agent_type`." }),
  state,
  parent: agentId.nullable().meta({ description: "null until the parent's spawn is linked." }),
  session: z.string().nullable(),
  package: z
    .string()
    .nullable()
    .meta({ description: "The dispatch package, relative to the project root." }),
  ticket: ticketId.nullable(),
  target: z.string().nullable(),
  startedAt: timestamp.nullable(),
  lastSeenAt: timestamp.nullable().meta({
    description: "The later of the last heartbeat and the start.",
  }),
};

const item = z.strictObject(itemShape) satisfies z.ZodType<AgentItem>;

const SCOUT = "a9f8e7d6c5b4a3f2e";
const WORKER = "a1b2c3d4e5f6a7b8c";
const SESSION = "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11";

export const agentsListOutput = z.strictObject({ agents: z.array(item) }).meta({
  title: "bdk agents list --json",
  description: "The agents of the registry with their state, parent and package.",
  examples: [
    {
      agents: [
        {
          id: WORKER,
          type: "bdk:worker",
          state: "running",
          parent: "main",
          session: SESSION,
          package: ".bdk/changes/2026-09-25-login/dispatch/02-implementer-A-9k2m4n6p.md",
          ticket: "A-9k2m4n6p",
          target: "02",
          startedAt: "2026-09-30T10:14:03.120Z",
          lastSeenAt: "2026-09-30T10:19:44.901Z",
        },
      ],
    },
  ],
}) satisfies z.ZodType<AgentsListReport>;

export const agentsShowOutput = z
  .strictObject({
    ...itemShape,
    linkedAt: timestamp.nullable(),
    openCallSince: timestamp.nullable().meta({
      description: "When the open tool call began; null without one.",
    }),
    endedAt: timestamp.nullable(),
    endedBy: endSignal.nullable(),
    continuations: count,
    children: z.array(
      z.strictObject({
        id: agentId,
        type: z.string().nullable(),
        state,
        target: z.string().nullable(),
      }),
    ),
  })
  .meta({
    title: "bdk agents show --json",
    description: "One agent of the registry with its lifecycle signals and children.",
    examples: [
      {
        id: WORKER,
        type: "bdk:worker",
        state: "running",
        parent: "main",
        session: SESSION,
        package: ".bdk/changes/2026-09-25-login/dispatch/02-implementer-A-9k2m4n6p.md",
        ticket: "A-9k2m4n6p",
        target: "02",
        startedAt: "2026-09-30T10:13:58.004Z",
        lastSeenAt: "2026-09-30T10:20:01.377Z",
        linkedAt: "2026-09-30T10:13:57.861Z",
        openCallSince: "2026-09-30T10:19:02.110Z",
        endedAt: null,
        endedBy: null,
        continuations: 0,
        children: [{ id: SCOUT, type: "bdk:scout", state: "running", target: null }],
      },
    ],
  }) satisfies z.ZodType<AgentsShowReport>;

const event = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("message"),
    from: agentId,
    entry: entryId.meta({ description: "The ledger entry the message points to." }),
  }),
  z.strictObject({
    kind: z.literal("report"),
    agent: agentId,
    ticket: ticketId,
    status: z.string().min(1).meta({ description: "The envelope's `status`." }),
  }),
  z.strictObject({ kind: z.literal("ended"), agent: agentId, by: endSignal }),
  z.strictObject({ kind: z.literal("suspect"), agent: agentId }),
  z.strictObject({ kind: z.literal("timeout") }),
]) satisfies z.ZodType<WaitEvent>;

export const agentsWaitOutput = z
  .strictObject({
    events: z.array(event).min(1),
    elapsed: count.meta({ description: "Seconds since the caller's start (T41-D8)." }),
    children: z
      .strictObject({ starting: count, running: count, suspect: count, ended: count })
      .meta({ description: "The caller's children in each state." }),
  })
  .meta({
    title: "bdk agents wait --json",
    description: "What the calling agent must react to, or a timeout.",
    examples: [
      {
        events: [
          { kind: "report", agent: WORKER, ticket: "A-9k2m4n6p", status: "done" },
          { kind: "message", from: "a7c6b5d4e3f2a1b0c", entry: "L-q7w2e9r4" },
        ],
        elapsed: 344,
        children: { starting: 0, running: 2, suspect: 0, ended: 1 },
      },
    ],
  }) satisfies z.ZodType<AgentsWaitReport>;
