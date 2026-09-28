// `attempts/<loop>-<target>-<ticket>.md` (`kernel-state`, Attempt record): one
// file per ticket, opened by `attempt open`, stamped with `package` by every
// `dispatch build`, with `rules-read` by the first `rules show --ticket` under
// the implementer package, and completed by `attempt close`.
import * as z from "zod";

import { author, hash, ledgerId, relativePath, scope, ticketId, timestamp } from "./common.ts";
import type { DocumentKind } from "./common.ts";
import { ENTRY_TYPES, LOOPS } from "../../vocabulary/index.ts";

const VERSION = 1;

const counter = z.int().min(1);

export const attemptKind = {
  name: "attempt",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      ticket: ticketId,
      loop: z.enum(LOOPS).meta({
        description:
          "The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).",
      }),
      target: z.string().min(1).meta({
        description:
          "Task id (task-redispatch), part id (verify-fix), Change id (review-fix) or artifact id (verifier).",
      }),
      attempt: counter,
      of: counter,
      scope,
      "narrowed-from": scope.optional(),
      escalation: z.boolean().optional().meta({
        description:
          "The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`.",
      }),
      "opened-at": timestamp,
      author,
      "closed-at": timestamp.optional().meta({ description: "Present exactly when `outcome` is." }),
      outcome: z.enum(["ok", "fail", "not-run"]).optional(),
      findings: z
        .array(
          z.strictObject({
            fingerprint: hash,
            type: z.enum(ENTRY_TYPES),
            file: relativePath,
            symbol: z.string().min(1).optional(),
          }),
        )
        .optional()
        .meta({ description: "Finding fingerprints of a `fail` (oscillation check)." }),
      dropped: z.array(ledgerId).optional(),
      package: relativePath.optional().meta({
        description:
          "The ticket's active package: the latest `dispatch build` of the ticket (T23-D42).",
      }),
      "rules-read": timestamp.optional().meta({
        description:
          "First `rules show --ticket` call under the ticket's implementer package (risk R2); read by `attempt close`.",
      }),
    })
    .superRefine((data, context) => {
      const closed = data["closed-at"] !== undefined;
      if (closed === (data.outcome !== undefined)) return;
      context.addIssue({
        code: "custom",
        path: [closed ? "outcome" : "closed-at"],
        message: "closed-at and outcome are present together or not at all",
      });
    })
    .meta({ title: "Attempt record", description: "The body is the close reason." }),
  migrations: [],
} as const satisfies DocumentKind;

export type AttemptRecord = z.output<typeof attemptKind.schema>;
