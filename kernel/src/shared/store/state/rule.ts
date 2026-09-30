// `.bdk/rules/<ruleId>.md` (`kernel-state`, Rule file frontmatter): the rule
// text is the body. Rule ids are not merge-safe by design; a parallel
// acceptance of the same number is the one permitted merge conflict.
import * as z from "zod";

import { CHANGE_ID_PATTERN } from "../../ids/index.ts";
import { RULE_ID } from "../../vocabulary/index.ts";
import { date, glob, role, severity } from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

/** A qualified ledger entry or attempt ticket: what `rules accept --from` names. */
const adoptedFrom = z.string().regex(new RegExp(`^${CHANGE_ID_PATTERN}/[LA]-[0-9a-z]{8}$`));

export const ruleKind = {
  name: "rule",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      id: z
        .string()
        .regex(RULE_ID)
        .meta({ description: "Equals the file name without `.md` (`CQ-4`, `BDK-SEC-2`)." }),
      kind: z.enum(["house", "knowledge"]),
      applies: z.array(glob).optional().meta({ description: "Absent: every file." }),
      roles: z.array(role).optional().meta({ description: "Absent: every role." }),
      severity,
      origin: z.union([z.enum(["bdk", "import", "user"]), adoptedFrom]).meta({
        description:
          "The shipped pack, `rules import`, `rules accept` without `--from`, or the entry or attempt it was adopted from.",
      }),
      evidence: z
        .array(adoptedFrom)
        .min(1)
        .optional()
        .meta({ description: "Every `--from` ref of `rules accept`." }),
      since: date,
      source: z.string().min(1).optional().meta({
        description: "Required exactly when `kind` is `knowledge`: where the fact comes from.",
      }),
      verified: date
        .optional()
        .meta({ description: "Required exactly when `kind` is `knowledge`." }),
      removed: z.string().min(1).optional().meta({
        description: "Tombstone reason; the id is never reused.",
      }),
    })
    .superRefine((data, context) => {
      const knowledge = data.kind === "knowledge";
      for (const key of ["source", "verified"] as const) {
        if (knowledge === (data[key] !== undefined)) continue;
        context.addIssue({
          code: "custom",
          path: [key],
          message: knowledge ? "required when kind is knowledge" : "only for kind knowledge",
        });
      }
    })
    .meta({ title: "Rule file" }),
  migrations: [],
} as const satisfies DocumentKind;
