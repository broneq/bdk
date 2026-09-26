// `evidence/<target>-<evidenceId>.md` (`kernel-state`, Evidence manifest):
// one verification artifact and the working-tree hash at capture.
import * as z from "zod";

import {
  agentSource,
  author,
  evidenceId,
  hash,
  relativePath,
  ticketId,
  timestamp,
} from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

export const evidenceKind = {
  name: "evidence",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      id: evidenceId,
      kind: z.string().min(1).meta({
        description: "`tests-scoped`, `lint`, `typecheck`, `ui-capture` or a project kind.",
      }),
      ticket: ticketId,
      target: z.string().min(1),
      at: timestamp,
      author,
      source: z.union([z.literal("kernel"), agentSource]),
      "tree-hash": hash,
      files: z
        .array(
          z.strictObject({
            path: relativePath,
            hash,
            stored: z.enum(["committed", "machine"]),
          }),
        )
        .min(1),
      verdict: z.enum(["pass", "fail", "not-run"]).optional(),
      citations: z.array(z.string().min(1)).optional().meta({
        description: "JSON pointers or snapshot lines (citation validator).",
      }),
    })
    .meta({ title: "Evidence manifest" }),
  migrations: [],
} as const satisfies DocumentKind;
