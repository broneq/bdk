// `change.md` (`kernel-state`, Change document): written once by `change new`.
import * as z from "zod";

import { author, changeId, commitSha, timestamp } from "./common.ts";
import type { DocumentKind } from "./common.ts";
import { CHANGE_KINDS, CHANGE_SOURCES, PROFILES } from "../../vocabulary/index.ts";

const VERSION = 1;

export const changeKind = {
  name: "change",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      id: changeId,
      kind: z.enum(CHANGE_KINDS),
      profile: z.enum(PROFILES),
      intent: z.string().min(1),
      source: z.enum(CHANGE_SOURCES),
      at: timestamp,
      author,
      overridden: z.array(z.string().min(1)),
      base: commitSha.optional().meta({
        description:
          "Only for kind review: `git merge-base HEAD <ref>` at opening, where the Change's range starts (T42).",
      }),
    })
    .meta({ title: "change.md", description: "The Change's identity and intent; never mutated." }),
  migrations: [],
} as const satisfies DocumentKind;
