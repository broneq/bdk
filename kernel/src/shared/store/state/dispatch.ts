// `dispatch/<target>-<role>-<ticket>.md` (`kernel-state`, Dispatch package):
// the frontmatter only, stamped whole by `dispatch build`; the body sections
// are the kernel template of `dispatch` (T23).
import { isAbsolute } from "node:path";

import * as z from "zod";

import {
  hash,
  ledgerId,
  relativePath,
  reviewGroup,
  role,
  scope,
  ticketId,
  timestamp,
} from "./common.ts";
import type { DocumentKind } from "./common.ts";
import { RULE_ID } from "../../vocabulary/index.ts";

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
      model: z.string().min(1).optional().meta({
        description:
          "The model the agent must run on: the escalation ticket's `model`, for every role but `runner` and `scout` (T41-D14).",
      }),
      at: timestamp,
      "kernel-version": z.string().min(1),
      "template-hash": hash,
      report: relativePath.meta({ description: "Where the role's report is written." }),
      draft: relativePath.meta({
        description:
          "Where the agent writes its report before `log ingest --file`: `.bdk/.machine/drafts/<package file name>` (#166).",
      }),
      rules: z.array(z.string().regex(RULE_ID)).meta({
        description: "The rules selected for the ticket, in order (T31); may be empty.",
      }),
      group: reviewGroup.optional().meta({
        description: "Review group of a `dispatch build --group` package (T42-A1).",
      }),
      files: z.array(relativePath).optional().meta({
        description: "The group's file set; present exactly when `group` is.",
      }),
      entries: z.array(ledgerId).optional().meta({
        description:
          "The entries a `judge` package lists to triage, in package order; present exactly on a `judge` package. `guard/judge-scope` reads it (#158).",
      }),
      workdir: z
        .string()
        .refine((path) => isAbsolute(path), "must be an absolute path")
        .optional()
        .meta({
          description:
            "The work root of the target when it is a live worktree part, or a task of one (T45); absent means the home checkout.",
        }),
    })
    .superRefine((data, context) => {
      if ((data.role === "judge") !== (data.entries !== undefined)) {
        context.addIssue({
          code: "custom",
          path: ["entries"],
          message: "entries is present exactly on a judge package",
        });
      }
      if ((data.group === undefined) === (data.files === undefined)) return;
      const missing = data.group === undefined ? "group" : "files";
      context.addIssue({ code: "custom", path: [missing], message: "group and files go together" });
    })
    .meta({ title: "Dispatch package" }),
  migrations: [],
} as const satisfies DocumentKind;

export type DispatchPackage = z.output<typeof dispatchKind.schema>;
