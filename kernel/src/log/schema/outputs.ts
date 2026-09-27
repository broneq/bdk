// Generates `schema/cli/output/log-{add,list,show,resolve}.json`
// (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { AppendResult, EntrySummary, ResolveResult, ShownEntry } from "../domain/entry.ts";
import { entryId, entrySummarySchema, entryViewSchema, relativePath } from "./entry.ts";

const CHANGE_DIR = ".bdk/changes/2026-09-25-passwordless-login";
const AUTHOR = "Jan Kowalski <jan@example.com>";

export const logAddOutput = z
  .strictObject({
    entry: entryViewSchema,
    path: relativePath,
    deduplicated: z.boolean().meta({
      description:
        "True when an equal entry existed: `entry` is that entry and nothing was written.",
    }),
  })
  .meta({
    title: "bdk log add --json",
    description: "Append one ledger entry; the kernel stamps id, time, author and source.",
    examples: [
      {
        entry: {
          id: "L-e8k2s5vw",
          type: "finding",
          summary: "expired magic link still accepted",
          status: "proposed",
          source: "agent:implementer",
          author: AUTHOR,
          at: "2026-09-25T10:15:02Z",
          refs: ["src/auth/login.ts", "02-3"],
          review: false,
          ticket: "A-7f3kx2p9",
        },
        path: `${CHANGE_DIR}/log/20260925T101502Z-finding-L-e8k2s5vw.md`,
        deduplicated: false,
      },
    ],
  }) satisfies z.ZodType<AppendResult>;

/** `schema/cli/common/list-page.json` narrowed to entry summaries. */
export const logListOutput = z
  .strictObject({
    items: z.array(entrySummarySchema),
    total: z.int().min(0),
    truncated: z.boolean(),
    for: z.string().optional().meta({ description: "The --for filter as given." }),
  })
  .meta({
    title: "bdk log list --json",
    description: "Ledger entries as summaries, filtered by type, status, review flag or reference.",
    examples: [
      {
        items: [
          {
            id: "L-m2x9v7qa",
            type: "decision",
            summary: "magic links, no passwords, WebAuthn later",
            status: "accepted",
            source: "kernel",
            at: "2026-09-25T09:41:07Z",
            refs: ["design.md"],
          },
        ],
        total: 1,
        truncated: false,
      },
    ],
  }) satisfies z.ZodType<{ items: readonly EntrySummary[] }>;

export const logShowOutput = z
  .strictObject({
    entry: entryViewSchema.extend({
      body: z.string().meta({ description: "Markdown body." }),
      path: relativePath,
    }),
    supersededBy: entryId.optional().meta({ description: "The entry that supersedes this one." }),
  })
  .meta({
    title: "bdk log show --json",
    description: "One entry in full, by bare or qualified id.",
    examples: [
      {
        entry: {
          id: "L-m2x9v7qa",
          type: "decision",
          summary: "magic links, no passwords, WebAuthn later",
          status: "accepted",
          source: "kernel",
          author: AUTHOR,
          at: "2026-09-25T09:41:07Z",
          refs: ["design.md"],
          review: false,
          body: "We ship magic links first; WebAuthn follows once the token store is proven.\n",
          path: `${CHANGE_DIR}/log/20260925T094107Z-decision-L-m2x9v7qa.md`,
        },
      },
    ],
  }) satisfies z.ZodType<ShownEntry>;

export const logResolveOutput = z
  .strictObject({
    entry: entryId,
    status: z.enum(["accepted", "resolved", "superseded"]),
    by: entryId.optional().meta({ description: "The superseding entry, for `superseded`." }),
    record: entryId.meta({
      description: "The rewritten entry: `entry`, or `by` for `superseded`.",
    }),
    reason: z.string().optional(),
  })
  .meta({
    title: "bdk log resolve --json",
    description: "Set an entry's status (resolved, accepted, superseded) with a reason.",
    examples: [
      {
        entry: "L-e8k2s5vw",
        status: "resolved",
        record: "L-e8k2s5vw",
        reason: "fixed in A-7f3kx2p9 retry",
      },
    ],
  }) satisfies z.ZodType<ResolveResult>;
