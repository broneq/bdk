// `reports/<target>-<role>-<ticket>.md` (`kernel-state`, Report envelope): the
// frontmatter is the role's envelope, the body the full report.
import * as z from "zod";

import { evidenceId, ledgerId, relativePath, role, ticketId } from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

export const reportKind = {
  name: "report",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      ticket: ticketId,
      role,
      status: z.enum(["done", "done-with-concerns", "needs-context", "blocked"]),
      files: z.array(relativePath),
      entries: z.array(ledgerId),
      evidence: z.array(evidenceId),
      reason: z.string().min(1).optional().meta({
        description: "Required for `blocked` and `needs-context`.",
      }),
    })
    .superRefine((data, context) => {
      if (data.status !== "blocked" && data.status !== "needs-context") return;
      if (data.reason !== undefined) return;
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: `required when status is ${data.status}`,
      });
    })
    .meta({ title: "Report envelope" }),
  migrations: [],
} as const satisfies DocumentKind;
