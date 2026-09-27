// The entry shapes shared by the log outputs (design D-15 of T20).
import * as z from "zod";

import { ENTRY_STATUSES, ENTRY_TYPES, SOURCE_PATTERN } from "../../shared/vocabulary/index.ts";

export const entryId = z
  .string()
  .regex(/^(?:\d{4}-\d{2}-\d{2}-[a-z0-9-]+\/)?L-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });

const entryType = z.enum(ENTRY_TYPES);

const derivedStatus = z.enum(ENTRY_STATUSES).meta({
  description: "Derived: `superseded` when another entry names this one in `supersedes`.",
});

const source = z
  .string()
  .regex(SOURCE_PATTERN)
  .meta({ description: "Who produced the entry (P1); stamped by the kernel." });

const timestamp = z.iso.datetime().meta({ description: "ISO 8601 UTC with seconds." });

const relativePath = z.string().min(1).meta({ description: "Path relative to the project root." });

const common = {
  id: entryId,
  type: entryType,
  summary: z.string().min(1).max(120),
  status: derivedStatus,
  source,
  at: timestamp,
  refs: z.array(z.string().min(1)).min(1),
};

export const entryViewSchema = z.strictObject({
  ...common,
  author: z.string().min(1),
  review: z.boolean(),
  ticket: z.string().optional(),
  supersedes: entryId.optional(),
  fingerprint: z.string().optional(),
  severity: z.string().optional(),
  category: z.string().optional(),
  options: z.array(z.string()).optional(),
  park: z.boolean().optional(),
  profile: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  applies: z.array(z.string()).optional(),
  routedTo: z.string().optional(),
  report: z.string().optional(),
  to: z.string().optional(),
  gate: z.string().optional(),
  session: z.string().optional(),
  command: z.string().optional(),
  skipVerify: z.boolean().optional(),
});

export const entrySummarySchema = z.strictObject({
  ...common,
  review: z.literal(true).optional().meta({ description: "Present only when true." }),
  ticket: z.string().optional(),
  supersedes: entryId.optional(),
  supersededBy: entryId.optional(),
});

export { relativePath };
