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
import { STORED_STATUSES } from "../../vocabulary/index.ts";
import type { EntryType } from "../../vocabulary/index.ts";

const VERSION = 1;

const category = z.string().min(1).meta({ description: "One of the P8 blocking categories." });

function variant<T extends EntryType, S extends z.ZodRawShape>(type: T, own: S) {
  return z.strictObject({
    schema: z.literal(VERSION),
    id: ledgerId,
    type: z.literal(type),
    summary: z.string().min(1).max(120),
    status: z.enum(STORED_STATUSES).meta({
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
  applies: z.array(glob).optional().meta({ description: "The files the lesson is about." }),
});

export const entryKind = {
  name: "entry",
  version: VERSION,
  schema: z
    .discriminatedUnion("type", [
      variant("decision", {
        profile: z.enum(["small", "large"]).optional().meta({
          description:
            "Written only by kernel commands that raise the profile; raises the effective profile.",
        }),
      }),
      variant("finding", { severity: severity.optional(), category: category.optional() }),
      variant("observation", { severity: severity.optional() }),
      variant("blocker", { category: category.optional() }),
      variant("question", {
        options: z.array(z.string().min(1)).optional(),
        park: z.boolean().optional().meta({
          description:
            "Written only by `change park` and by `attempt close` at the end of the ladder; marks the question that parks the Change.",
        }),
      }),
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
        auto: z.boolean().optional().meta({
          description:
            "A gate passed by policy because the run had --auto; written only by the hooks (T41). Such a transition counts at a manual gate.",
        }),
        "input-hash": hash.optional().meta({
          description:
            "sha256 of the node's inputs; written only by `done` and `part done` (P2). A transition carrying it is the node's done marker.",
        }),
      }),
    ])
    .meta({ title: "Ledger entry", description: "One file per entry; the body is free Markdown." }),
  migrations: [],
} as const satisfies DocumentKind;
