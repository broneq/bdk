// `dispatch/pruned.md`, `reports/pruned.md` (`kernel-state`, Pruned index):
// written by the archive prune in place of the directory's other files, so
// every hash a manifest or an entry names stays checkable. The body is empty.
import * as z from "zod";

import { hash, timestamp } from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

const PRUNED_DIRS = ["dispatch", "reports"] as const;

export const prunedKind = {
  name: "pruned",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      dir: z.enum(PRUNED_DIRS).meta({ description: "The directory it indexes." }),
      at: timestamp,
      files: z
        .array(
          z.strictObject({
            path: z
              .string()
              .regex(/^[^/\\]+$/)
              .meta({ description: "The removed file's name within `dir`." }),
            hash,
            bytes: z.int().min(0),
          }),
        )
        .meta({ description: "Each removed file: name, `sha256:` hash, size." }),
    })
    .meta({ title: "Pruned index" }),
  migrations: [],
} as const satisfies DocumentKind;
