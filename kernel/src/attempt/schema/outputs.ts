// Generates `schema/cli/output/attempt-{open,close,list}.json`
// (kernel/scripts/export-schemas.ts), replacing the hand-written T11 shapes.
import * as z from "zod";

import type {
  AttemptCloseReport,
  AttemptItem,
  AttemptListReport,
  AttemptOpenReport,
  AttemptShowReport,
} from "../domain/reports.ts";
import { LOOPS, TICKET_SCOPES } from "../../shared/vocabulary/index.ts";

const opaque = (prefix: "A" | "L") =>
  z
    .string()
    .regex(new RegExp(`^${prefix}-[0-9a-z]{8}$`))
    .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const ticketId = opaque("A");
const entryId = opaque("L");
const loop = z.enum(LOOPS).meta({
  description: "The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).",
});
const target = z.string().min(1).meta({
  description: "Part id (part, verify-fix), Change id (review-fix) or artifact id (verifier).",
});
const scope = z.enum(TICKET_SCOPES);
const outcome = z.enum(["ok", "fail", "not-run"]);
const timestamp = z.iso
  .datetime({ precision: 3 })
  .meta({ description: "ISO 8601 UTC with milliseconds." });
const count = z.int().min(0);
const path = z.string().meta({ description: "Path relative to the project root." });
const step = z.union([
  z.strictObject({
    kind: z.string().min(1).meta({ description: "The step's evidence kind." }),
    role: z.string().min(1).meta({ description: "The role whose agent runs the step." }),
  }),
  z.strictObject({
    kind: z.string().min(1).meta({ description: "The step's evidence kind." }),
    command: z.string().min(1).meta({ description: "The kernel command that records it." }),
  }),
]);
const base = z
  .string()
  .regex(/^[0-9a-f]{40,64}$/)
  .meta({
    description:
      "A part or verify-fix ticket: the commit HEAD of the part's work root pointed at when it opened (#166).",
  });

export const attemptOpenOutput = z
  .strictObject({
    ticket: ticketId,
    loop,
    target,
    attempt: z.int().min(1),
    of: z.int().min(1).meta({ description: "The loop's budget for the round." }),
    scope,
    openedAt: timestamp,
    base: base.optional(),
    narrowedFrom: scope.optional(),
    dropped: z
      .array(z.strictObject({ id: entryId, summary: z.string() }))
      .optional()
      .meta({ description: "Proposed findings of the previous fail that the new scope drops." }),
    entry: entryId.optional().meta({
      description: "The kernel finding that records the dropped findings for the review gate.",
    }),
    escalation: z
      .strictObject({
        model: z.string().min(1).meta({ description: "From policy.escalation.model." }),
      })
      .optional()
      .meta({ description: "Present on the round's escalation ticket (--escalate)." }),
    steps: z.array(step).optional().meta({
      description:
        "The post-task steps of the ticket after the implementer, in pipeline order: the agent step and the kernel checks; only for part, verify-fix and review-fix.",
    }),
    merge: z.literal(true).optional().meta({
      description:
        "A merge ticket: the kernel started merging the Change branch into the part's worktree (T45).",
    }),
    conflicts: z.array(z.string().min(1)).min(1).optional().meta({
      description:
        "The paths git reports unmerged in the worktree; present exactly when `merge` is.",
    }),
  })
  .meta({
    title: "bdk attempt open --json",
    description:
      "Open a ticket for one loop iteration, or refuse with the next rung of the ladder.",
    examples: [
      {
        ticket: "A-7f3k9m2q",
        loop: "part",
        target: "02",
        attempt: 2,
        of: 3,
        scope: "high+",
        openedAt: "2026-09-25T10:02:11.482Z",
        base: "4c1d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
        narrowedFrom: "full",
        dropped: [{ id: "L-d3f6g8h2", summary: "rename helper for clarity" }],
        entry: "L-k4n8p2rt",
        steps: [
          { kind: "conform", role: "conformer" },
          { kind: "tests-scoped", command: "bdk check run" },
          { kind: "lint", command: "bdk check run" },
        ],
      },
    ],
  }) satisfies z.ZodType<AttemptOpenReport>;

export const attemptCloseOutput = z
  .strictObject({
    ticket: ticketId,
    outcome,
    diff: z
      .strictObject({
        declared: z.array(path),
        touched: z.array(path),
        undeclared: z.array(path).meta({
          description: "Files outside Files:, recorded as a kernel finding entry.",
        }),
      })
      .optional()
      .meta({ description: "The diff check; absent for a verifier ticket." }),
    findings: z.array(entryId).optional().meta({
      description: "Kernel finding entries the close wrote.",
    }),
    fingerprints: z.array(z.string()).optional().meta({
      description: "Fingerprints stored on a fail record (`kernel-loops`, oscillation).",
    }),
    rulesFinding: entryId.optional().meta({
      description:
        "The reviewed kernel finding written when an implementer ticket closes without `rules-read` (T23-D28).",
    }),
    notRunCount: count.meta({ description: "The round's consecutive not-run closes." }),
    next: z.strictObject({
      action: z
        .enum(["commit", "part-done", "review-done", "retry", "narrow", "escalate", "parked"])
        .meta({
          description:
            "part-done after ok of a part or verify-fix ticket; review-done after ok of a review-fix ticket; commit after ok of a verifier ticket; the ladder's rung after fail or not-run.",
        }),
      scope: scope.optional(),
      entry: entryId.optional().meta({ description: "The ladder question that parks the Change." }),
      why: z.string().optional(),
      resume: z.string().optional().meta({ description: "The command that answers the question." }),
    }),
  })
  .meta({
    title: "bdk attempt close --json",
    description:
      "Close a ticket with its outcome; check the diff, the evidence and the declared entries.",
    examples: [
      {
        ticket: "A-7f3k9m2q",
        outcome: "fail",
        diff: {
          declared: ["src/auth/login.ts"],
          touched: ["src/auth/login.ts", "src/auth/util.ts"],
          undeclared: ["src/auth/util.ts"],
        },
        findings: ["L-e8k2s5vw"],
        fingerprints: ["sha256:3f1c9a0b7d2e4c6f8a1b3d5e7f9a0c2e4b6d8f0a1c3e5a7b9d1f3a5c7e9b1d3f"],
        notRunCount: 0,
        next: { action: "narrow", scope: "blockers" },
      },
    ],
  }) satisfies z.ZodType<AttemptCloseReport>;

const attemptItem = z.strictObject({
  ticket: ticketId,
  loop,
  target,
  attempt: z.int().min(1),
  of: z.int().min(1),
  scope,
  openedAt: timestamp,
  closedAt: timestamp.optional(),
  outcome: outcome.optional(),
  escalation: z.literal(true).optional(),
  entries: count.optional().meta({
    description: "Ledger entries written under the ticket; with --for.",
  }),
}) satisfies z.ZodType<AttemptItem>;

const attemptShowFields = {
  ...attemptItem.shape,
  base: base.optional(),
  steps: z.array(step).optional().meta({
    description:
      "The post-task steps of the ticket, as `attempt open` returned them; only for part, verify-fix and review-fix.",
  }),
};

const budget = z.strictObject({ used: count, of: count });

export const attemptListOutput = z
  .strictObject({
    items: z.array(attemptItem),
    total: count,
    truncated: z.boolean(),
    for: z.string().optional().meta({ description: "The --for filter as given." }),
    budgets: z.record(z.string(), budget).optional().meta({
      description:
        "With --for: `used` and `of` of each loop's current round of the target, and `not-run` the consecutive not-run counter.",
    }),
  })
  .meta({
    title: "bdk attempt list --json",
    description: "Tickets and attempt records, open first.",
    examples: [
      {
        items: [
          {
            ticket: "A-7f3k9m2q",
            loop: "part",
            target: "02",
            attempt: 2,
            of: 3,
            scope: "high+",
            openedAt: "2026-09-25T10:02:11.482Z",
            closedAt: "2026-09-25T10:19:40.917Z",
            outcome: "fail",
            entries: 2,
          },
        ],
        total: 1,
        truncated: false,
        for: "02",
        budgets: { part: { used: 2, of: 3 }, "not-run": { used: 0, of: 3 } },
      },
    ],
  }) satisfies z.ZodType<AttemptListReport>;

export const attemptShowOutput = z.strictObject(attemptShowFields).meta({
  title: "bdk attempt show --json",
  description: "One ticket's record: loop, target, state and steps.",
  examples: [
    {
      ticket: "A-7f3k9m2q",
      loop: "part",
      target: "02",
      attempt: 2,
      of: 3,
      scope: "high+",
      openedAt: "2026-09-25T10:02:11.482Z",
      base: "4c1d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
      steps: [
        { kind: "conform", role: "conformer" },
        { kind: "tests-scoped", command: "bdk check run" },
        { kind: "lint", command: "bdk check run" },
      ],
    },
  ],
}) satisfies z.ZodType<AttemptShowReport>;
