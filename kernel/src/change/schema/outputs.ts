// Generates `schema/cli/output/change-{new,status,list,resume,park,takeover,checkpoint}.json`
// (kernel/scripts/export-schemas.ts; design D-14, D-15 of T20).
import * as z from "zod";

import type {
  CheckpointReport,
  ListItem,
  NewReport,
  ParkReport,
  ResumeReport,
  StatusReport,
  TakeoverReport,
} from "../domain/change.ts";
import { CHANGE_STATES, PART_STATES, RESUMED_FROM, SPEC_IMPACTS } from "../domain/change.ts";
import {
  CHANGE_KINDS,
  CHANGE_SOURCES,
  ENTRY_STATUSES,
  ENTRY_TYPES,
  GATE_PASSERS,
  NODE_STATES,
  PROFILES,
  SOURCE_PATTERN,
  TICKET_SCOPES,
} from "../../shared/vocabulary/index.ts";

const CHANGE = "2026-09-25-passwordless-login";

const changeId = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const entryId = z
  .string()
  .regex(/^L-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const kind = z.enum(CHANGE_KINDS);
const profile = z.enum(PROFILES);
const source = z.enum(CHANGE_SOURCES);
const timestamp = z.iso
  .datetime({ precision: 3 })
  .meta({ description: "ISO 8601 UTC with milliseconds." });
const next = z
  .string()
  .optional()
  .meta({ description: "The next command; absent until the artifact graph lands (T21)." });
const overriddenKeys = z
  .array(z.string())
  .meta({ description: "Keys the global or local layer sets (D4b), names only." });
const node = z.strictObject({
  id: z.string().min(1),
  kind: z.string().min(1).meta({ description: "Artifact kind from pipeline.yaml (T21)." }),
  state: z.enum(NODE_STATES),
  requires: z.array(z.string()).optional(),
  inputHash: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .optional(),
  why: z
    .string()
    .optional()
    .meta({ description: "For blocked and stale: what is missing or what changed." }),
});
const pendingEntry = z.strictObject({
  id: entryId,
  type: z.enum(ENTRY_TYPES),
  summary: z.string().min(1).max(120),
  status: z.enum(ENTRY_STATUSES),
  source: z.string().regex(SOURCE_PATTERN),
  author: z.string().optional(),
  at: timestamp,
  refs: z.array(z.string()).min(1),
  review: z.boolean().optional(),
  supersedes: entryId.optional(),
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
      .array(pendingEntry)
      .meta({ description: "review: true entries listed, never dispositioned." }),
  })
  .meta({ description: "What the user sees before typing the next stage command (T1)." });
const part = z.strictObject({
  part: z.string().regex(/^\d{2}$/),
  title: z.string().min(1),
  state: z.enum(PART_STATES),
  tasks: z.int().min(0).max(8),
  done: z.int().min(0).optional(),
  bytes: z.int().min(0).max(8192),
  dependsOn: z.array(z.string()).optional(),
  specImpact: z.enum(SPEC_IMPACTS).optional(),
  wave: z.int().min(1).optional(),
});

export const changeNewOutput = z
  .strictObject({
    change: changeId,
    branch: z.string().min(1),
    kind,
    profile: z.strictObject({
      value: profile,
      defaulted: z.boolean().meta({ description: "True when the caller passed no --profile." }),
      entry: entryId.meta({ description: "The assumption entry recording the profile." }),
    }),
    source,
    overriddenKeys,
    next,
  })
  .meta({
    title: "bdk change new --json",
    description:
      "Open a Change on the current branch from an intent and record its starting profile.",
    examples: [
      {
        change: CHANGE,
        branch: "feat/login",
        kind: "feature",
        profile: { value: "small", defaulted: true, entry: "L-8n4vq6hy" },
        source: "user",
        overriddenKeys: ["policy.escalation.enabled"],
      },
    ],
  }) satisfies z.ZodType<NewReport>;

export const changeStatusOutput = z
  .strictObject({
    change: changeId,
    kind,
    profile: profile.meta({
      description: "The effective profile (`kernel-state`, Derived state).",
    }),
    source,
    confirmed: z.boolean().meta({
      description: "False while an inferred Change has no transition with source user.",
    }),
    stage: z.string().min(1),
    parked: z
      .strictObject({
        entry: entryId,
        options: z.array(z.string()),
        resume: z.string().meta({ description: "The single resume command." }),
      })
      .optional(),
    nodes: z.array(node).meta({ description: "Empty until the artifact graph lands (T21)." }),
    gates: z.array(gate).meta({ description: "Empty until the artifact graph lands (T21)." }),
    parts: z.array(part).meta({ description: "Empty until plan parts land (T22)." }),
    openTickets: z.array(
      z.strictObject({
        ticket: z.string(),
        loop: z.string(),
        target: z.string(),
        attempt: z.int().min(1),
        of: z.int().min(1),
        scope: z.enum(TICKET_SCOPES),
        openedAt: timestamp,
      }),
    ),
    overriddenKeys,
  })
  .meta({
    title: "bdk change status --json",
    description:
      "The active Change at a glance: stage, graph state, gate status with pending review entries, parked options.",
    examples: [
      {
        change: CHANGE,
        kind: "feature",
        profile: "large",
        source: "user",
        confirmed: true,
        stage: "design",
        nodes: [
          { id: "design", kind: "design", state: "done" },
          { id: "gate:design", kind: "gate", state: "ready" },
        ],
        gates: [
          {
            gate: "gate:design",
            ready: true,
            done: false,
            command: "/bdk:plan",
            pending: [
              {
                id: "L-k3d8p2xq",
                type: "question",
                summary: "Keep magic links or add WebAuthn?",
                status: "proposed",
                source: "agent:design-verifier",
                at: "2026-09-25T09:41:07.123Z",
                refs: ["design.md"],
                review: true,
              },
            ],
          },
        ],
        parts: [],
        openTickets: [],
        overriddenKeys: ["policy.escalation.enabled"],
      },
    ],
  }) satisfies z.ZodType<StatusReport>;

export const changeListOutput = z
  .strictObject({
    items: z.array(
      z.strictObject({
        change: changeId,
        branch: z.string().optional().meta({
          description: "The local branch bound to the Change; absent when no marker binds it.",
        }),
        stage: z.string().min(1),
        state: z.enum(CHANGE_STATES),
        kind,
        profile,
        updatedAt: timestamp,
      }),
    ),
    total: z.int().min(0),
    truncated: z.boolean(),
  })
  .meta({
    title: "bdk change list --json",
    description: "List Changes in this repository: active per branch, parked, archived.",
    examples: [
      {
        items: [
          {
            change: CHANGE,
            branch: "feat/login",
            stage: "design",
            state: "active",
            kind: "feature",
            profile: "small",
            updatedAt: "2026-09-25T09:41:07.123Z",
          },
        ],
        total: 1,
        truncated: false,
      },
    ],
  }) satisfies z.ZodType<{ items: readonly ListItem[] }>;

export const changeResumeOutput = z
  .strictObject({
    change: changeId,
    branch: z.string().min(1),
    stage: z.string().min(1),
    resumedFrom: z.enum(RESUMED_FROM).optional(),
    decision: entryId.optional().meta({
      description: "The decision entry written: the chosen option, else the raised profile.",
    }),
    next,
  })
  .meta({
    title: "bdk change resume --json",
    description:
      "Bind an existing Change to the current branch or leave the parked state with a chosen option.",
    examples: [
      {
        change: CHANGE,
        branch: "feat/login",
        stage: "execute",
        resumedFrom: "parked",
        decision: "L-p9q2r4tx",
      },
    ],
  }) satisfies z.ZodType<ResumeReport>;

const checkpointFields = {
  done: z.boolean(),
  commit: z
    .string()
    .regex(/^[0-9a-f]{7}$/)
    .optional()
    .meta({ description: "The checkpoint commit, abbreviated; present when done." }),
  skipped: z
    .string()
    .min(1)
    .optional()
    .meta({ description: "Why no checkpoint commit was made; present when not done." }),
};

const checkpointView = z.strictObject(checkpointFields).meta({
  description: "The checkpoint of the Change directory (`kernel-loops`, Checkpoint).",
});

export const changeParkOutput = z
  .strictObject({
    change: changeId,
    entry: entryId.meta({ description: "The park question." }),
    options: z.array(z.string().min(1)).min(1),
    resume: z.string(),
    checkpoint: checkpointView,
  })
  .meta({
    title: "bdk change park --json",
    description:
      "Park the active Change with a question or blocker entry, options and one resume command.",
    examples: [
      {
        change: CHANGE,
        entry: "L-t4w7n3kd",
        options: ["accept as debt", "split part 02"],
        resume: `bdk change resume ${CHANGE} --option <n>`,
        checkpoint: { done: true, commit: "a1b2c3d" },
      },
    ],
  }) satisfies z.ZodType<ParkReport>;

export const changeTakeoverOutput = z
  .strictObject({
    change: changeId,
    previousSession: z
      .string()
      .optional()
      .meta({ description: "The session that held the tickets; stamped from T24." }),
    closedTickets: z
      .array(z.string().regex(/^A-[0-9a-z]{8}$/))
      .min(1)
      .meta({ description: "The tickets closed as not-run with the body `taken over`." }),
    rebuilt: z.boolean().meta({ description: "The rebuild of `bdk rebuild` ran for the Change." }),
  })
  .meta({
    title: "bdk change takeover --json",
    description: "Take over a Change whose previous session died with open tickets.",
    examples: [{ change: CHANGE, closedTickets: ["A-7f3k9m2q"], rebuilt: true }],
  }) satisfies z.ZodType<TakeoverReport>;

export const changeCheckpointOutput = z
  .strictObject({ change: changeId, ...checkpointFields })
  .meta({
    title: "bdk change checkpoint --json",
    description: "Pathspec commit of the Change directory: `chore(bdk): checkpoint <change>`.",
    examples: [{ change: CHANGE, done: true, commit: "a1b2c3d" }],
  }) satisfies z.ZodType<CheckpointReport>;
