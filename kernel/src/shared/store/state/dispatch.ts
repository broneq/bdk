// `dispatch/<target>-<role>-<ticket>.md` (`kernel-state`, Dispatch package):
// the frontmatter only, stamped whole by `dispatch build`; the body sections
// are the kernel template of `dispatch` (T23).
import * as z from "zod";

import { hash, relativePath, role, scope, ticketId, timestamp } from "./common.ts";
import type { DocumentKind } from "./common.ts";
import { RULE_ID } from "./rule.ts";

const VERSION = 1;

export const dispatchKind = {
  name: "dispatch",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      ticket: ticketId,
      target: z.string().min(1),
      role,
      adapter: z.string().min(1).meta({
        description: "The role's adapter (`role-contracts`, Role-to-adapter map).",
      }),
      attempt: z.int().min(1),
      of: z.int().min(1),
      scope,
      at: timestamp,
      "kernel-version": z.string().min(1),
      "template-hash": hash,
      report: relativePath.meta({ description: "Where the role's report is written." }),
      rules: z.array(z.string().regex(RULE_ID)).meta({
        description: "The rules selected for the ticket, in order (T31); may be empty.",
      }),
      "rules-truncated": z.int().min(0).meta({
        description: "Rules dropped at `rules.max-per-package`.",
      }),
    })
    .meta({ title: "Dispatch package" }),
  migrations: [],
} as const satisfies DocumentKind;

export type DispatchPackage = z.output<typeof dispatchKind.schema>;
