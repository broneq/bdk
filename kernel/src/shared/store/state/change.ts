// `change.md` (`kernel-state`, Change document): written once by `change new`.
import * as z from "zod";

import { author, changeId, timestamp } from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

export const changeKind = {
  name: "change",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      id: changeId,
      kind: z.enum(["feature", "bug"]),
      profile: z.enum(["tiny", "small", "large"]),
      intent: z.string().min(1),
      source: z.enum(["user", "inferred"]),
      at: timestamp,
      author,
      overridden: z.array(z.string().min(1)),
    })
    .meta({ title: "change.md", description: "The Change's identity and intent; never mutated." }),
  migrations: [],
} as const satisfies DocumentKind;
