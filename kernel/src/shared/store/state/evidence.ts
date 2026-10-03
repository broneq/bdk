// `evidence/<target>-<evidenceId>.md` (`kernel-state`, Evidence manifest):
// one verification artifact and the working-tree hash at capture. Committed
// captures sit beside it as `evidence/<target>-<evidenceId>-<file name>`.
import * as z from "zod";

import {
  agentSource,
  author,
  evidenceId,
  hash,
  relativePath,
  reviewGroup,
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
        description:
          "`tests-scoped`, `lint`, `tests-full`, `lint-full`, `coverage`, `typecheck`, `ui-capture` or a project kind.",
      }),
      ticket: ticketId,
      group: reviewGroup.optional().meta({ description: "The review group of the record." }),
      tool: z.string().min(1).optional().meta({
        description: "Only on `coverage`: the `tools.test` id measured.",
      }),
      target: z.string().min(1),
      at: timestamp,
      author,
      source: z.union([z.literal("kernel"), agentSource]),
      "tree-hash": hash,
      tree: z
        .array(z.strictObject({ path: relativePath, hash: z.union([hash, z.literal("absent")]) }))
        .meta({
          description:
            "The covered files the tree hash was computed over, in path order; `absent` for a deleted file.",
        }),
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
    .superRefine((data, context) => {
      if ((data.kind === "coverage") === (data.tool !== undefined)) return;
      context.addIssue({
        code: "custom",
        path: ["tool"],
        message: "required on coverage, only there",
      });
    })
    .meta({ title: "Evidence manifest" }),
  migrations: [],
} as const satisfies DocumentKind;

export type EvidenceManifest = z.output<typeof evidenceKind.schema>;
