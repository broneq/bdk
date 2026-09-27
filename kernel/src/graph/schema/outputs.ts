// Generates `schema/cli/output/{next,explain,validate,done}.json`
// (kernel/scripts/export-schemas.ts), replacing the hand-written T11 shapes.
import * as z from "zod";

import { WAITING } from "../domain/reports.ts";
import { GATE_PASSERS, NODE_STATES } from "../../shared/vocabulary/index.ts";
import type { DoneReport, ExplainReport, NextReport, ValidateReport } from "../domain/reports.ts";
import {
  ENTRY_STATUSES,
  ENTRY_TYPES,
  PROFILES,
  SOURCE_PATTERN,
} from "../../shared/vocabulary/index.ts";

const entryId = z
  .string()
  .regex(/^L-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const node = z.strictObject({
  id: z.string().min(1),
  kind: z.string().min(1).meta({ description: "Artifact kind from pipeline.yaml (T21)." }),
  state: z.enum(NODE_STATES),
  requires: z.array(z.string()).optional(),
  inputHash: hash.optional(),
  why: z.string().optional().meta({
    description: "For blocked, stale, skipped and gates: what is missing or what changed.",
  }),
});

const gate = z
  .strictObject({
    gate: z.string().min(1).meta({ description: "Gate node id, e.g. gate:design." }),
    ready: z.boolean(),
    done: z.boolean(),
    passedBy: z.enum(GATE_PASSERS).optional(),
    command: z
      .string()
      .optional()
      .meta({ description: "The stage command the user types to pass it, e.g. /bdk:plan." }),
    pending: z
      .array(
        z.strictObject({
          id: entryId,
          type: z.enum(ENTRY_TYPES),
          summary: z.string().min(1).max(120),
          status: z.enum(ENTRY_STATUSES),
          source: z.string().regex(SOURCE_PATTERN),
          author: z.string().optional(),
          at: z.iso.datetime().meta({ description: "ISO 8601 UTC with seconds." }),
          refs: z.array(z.string()).min(1),
          review: z.boolean().optional(),
          supersedes: entryId.optional(),
        }),
      )
      .meta({ description: "review: true entries listed, never dispositioned." }),
  })
  .meta({ description: "What the user sees before typing the next stage command (T1)." });

const check = z.strictObject({
  id: z.string().min(1),
  ok: z.boolean(),
  why: z.string().optional(),
  rule: z.string().optional(),
  instead: z.string().optional(),
});

export const nextOutput = z
  .strictObject({
    change: z.string().meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." }),
    stage: z.string().min(1),
    artifact: node.optional(),
    instruction: z
      .string()
      .optional()
      .meta({ description: "Markdown built from the kind's template, rules and ledger (T21)." }),
    gates: z.array(gate),
    waiting: z
      .enum(WAITING)
      .optional()
      .meta({ description: "Set when no artifact is actionable: what the Change waits for." }),
  })
  .meta({
    title: "bdk next --json",
    description:
      "The next ready artifact with its instruction, plus the gate status; the skill's entry point.",
    examples: [
      {
        change: "2026-09-25-passwordless-login",
        stage: "plan",
        artifact: {
          id: "plan-part:01",
          kind: "plan-part",
          state: "ready",
          requires: ["gate:design"],
        },
        instruction: "# plan-part:01 (plan-part)\n\nWrite plan part plan-part:01 ...\n",
        gates: [{ gate: "gate:design", ready: true, done: true, passedBy: "user", pending: [] }],
      },
    ],
  }) satisfies z.ZodType<NextReport>;

export const explainOutput = z
  .strictObject({
    artifact: z.string().min(1),
    state: z.enum(NODE_STATES),
    chain: z
      .array(node)
      .meta({ description: "The artifact, then its transitive requirements, latest first." }),
    profile: z.enum(PROFILES),
    conditions: z
      .array(z.string())
      .optional()
      .meta({ description: "if: features.X conditions that applied." }),
  })
  .meta({
    title: "bdk explain --json",
    description:
      "Why an artifact is in its state: the `requires` chain with each node's state and input hash.",
    examples: [
      {
        artifact: "plan-verify",
        state: "blocked",
        profile: "small",
        chain: [
          {
            id: "plan-verify",
            kind: "plan-verify",
            state: "blocked",
            requires: ["plan-part:01"],
            why: "plan-part:01 is ready, not done",
          },
          { id: "plan-part:01", kind: "plan-part", state: "ready", requires: ["gate:design"] },
          { id: "gate:design", kind: "gate", state: "done" },
        ],
      },
    ],
  }) satisfies z.ZodType<ExplainReport>;

export const validateOutput = z
  .strictObject({
    artifact: z.string().min(1),
    valid: z.boolean(),
    inputHash: hash.optional(),
    checks: z.array(check),
  })
  .meta({
    title: "bdk validate --json",
    description: "Run an artifact's kind validator without marking it done.",
    examples: [
      {
        artifact: "plan-part:01",
        valid: true,
        inputHash: `sha256:${"0".repeat(64)}`,
        checks: [
          { id: "exists", ok: true },
          { id: "non-empty", ok: true },
          { id: "schema", ok: true },
        ],
      },
    ],
  }) satisfies z.ZodType<ValidateReport>;

export const doneOutput = z
  .strictObject({
    artifact: z.string().min(1),
    state: z.literal("done"),
    inputHash: hash,
    next: z.string().min(1).meta({
      description:
        "The artifact next now returns, the gate the Change waits for, user when parked, or nothing.",
    }),
    entry: entryId.optional().meta({
      description: "The entry written, or the existing one when the node was already done.",
    }),
  })
  .meta({
    title: "bdk done --json",
    description: "Mark an artifact done after its validator passes and record the input hash.",
    examples: [
      {
        artifact: "design",
        state: "done",
        inputHash: `sha256:${"1".repeat(64)}`,
        next: "gate:design",
        entry: "L-h6s1d3ne",
      },
    ],
  }) satisfies z.ZodType<DoneReport>;
