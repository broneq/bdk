// `attempts/<loop>-<target>-<ticket>.md` (`kernel-state`, Attempt record): one
// file per ticket, opened by `attempt open` and completed by `attempt close`.
import * as z from "zod";

import { author, hash, ledgerId, relativePath, scope, ticketId, timestamp } from "./common.ts";
import type { DocumentKind } from "./common.ts";
import { ENTRY_TYPES } from "./entry.ts";

const VERSION = 1;

const counter = z.int().min(1);

export const attemptKind = {
  name: "attempt",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      ticket: ticketId,
      loop: z.string().min(1).meta({ description: "Loop kind from policy." }),
      target: z.string().min(1).meta({ description: "Task, part, artifact or Change id." }),
      attempt: counter,
      of: counter,
      scope,
      "narrowed-from": scope.optional(),
      escalation: z.boolean().optional(),
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
