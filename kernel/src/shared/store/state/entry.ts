// `log/<ts>-<type>-<id>.md` (`kernel-state`, Ledger entry): the common fields
// plus the own fields of the entry's type. A type's own fields are closed:
// each variant is a strict object, so a field of one type fails on another.
import * as z from "zod";

import {
  author,
  hash,
  glob,
  idReference,
  ledgerId,
  provenance,
  relativePath,
  severity,
  ticketId,
  timestamp,
} from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

export const ENTRY_TYPES = [
  "decision",
  "finding",
  "observation",
  "blocker",
  "question",
  "assumption",
  "risk",
  "learning",
  "report",
  "transition",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

const category = z.string().min(1).meta({ description: "One of the P8 blocking categories." });

function variant<T extends EntryType, S extends z.ZodRawShape>(type: T, own: S) {
  return z.strictObject({
    schema: z.literal(VERSION),
    id: ledgerId,
    type: z.literal(type),
    summary: z.string().min(1).max(120),
    status: z.enum(["proposed", "accepted", "resolved", "routed"]).meta({
      description: "`superseded` is derived from `supersedes`, never stored.",
    }),
    source: provenance,
    author,
    at: timestamp,
    ticket: ticketId.optional(),
    refs: z.array(z.string().min(1)).min(1),
    supersedes: idReference.optional(),
    review: z.boolean().optional(),
    ...own,
  });
}

const learning = variant("learning", {
  fingerprint: hash.meta({ description: "Kernel-stamped (`kernel-state`, Fingerprints)." }),
  evidence: z.array(idReference).optional(),
  applies: z.array(glob).optional(),
  "routed-to": z.enum(["rule", "spec", "nothing"]).optional(),
}).superRefine((data, context) => {
  if (data.status === "routed" && data["routed-to"] === undefined) {
    context.addIssue({
      code: "custom",
      path: ["routed-to"],
      message: "required when status is routed",
    });
  }
});

export const entryKind = {
  name: "entry",
  version: VERSION,
  schema: z
    .discriminatedUnion("type", [
      variant("decision", {}),
      variant("finding", { severity: severity.optional(), category: category.optional() }),
      variant("observation", { severity: severity.optional() }),
      variant("blocker", { category: category.optional() }),
      variant("question", { options: z.array(z.string().min(1)).optional() }),
      variant("assumption", {}),
      variant("risk", {}),
      learning,
      variant("report", { report: relativePath }),
      variant("transition", {
        to: z.string().min(1).meta({ description: "Stage, artifact id, gate id or `closed`." }),
        gate: z.string().min(1).optional(),
        session: z.string().min(1).optional(),
        command: z.string().min(1).optional(),
        "skip-verify": z.boolean().optional(),
      }),
    ])
    .meta({ title: "Ledger entry", description: "One file per entry; the body is free Markdown." }),
  migrations: [],
} as const satisfies DocumentKind;
