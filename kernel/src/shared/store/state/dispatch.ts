// `dispatch/<target>-<role>-<ticket>.md` (`kernel-state`, Dispatch package):
// the frontmatter only; the body sections belong to T23.
import * as z from "zod";

import { hash, relativePath, role, scope, ticketId, timestamp } from "./common.ts";
import type { DocumentKind } from "./common.ts";

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
      attempt: z.int().min(1),
      of: z.int().min(1),
      scope,
      at: timestamp,
      "kernel-version": z.string().min(1),
      "template-hash": hash,
      report: relativePath.meta({ description: "Where the role's report is written." }),
    })
    .meta({ title: "Dispatch package" }),
  migrations: [],
} as const satisfies DocumentKind;
