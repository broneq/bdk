// The settings `ctx` reads (`kernel-settings`, Keys of the project toolchain,
// Prompt values): the Lavish switch, the concurrency and the fragment texts a
// project may extend or replace; the project's commands are `shared/config`'s. The rule texts and
// `languages` belong to `rules` (T23-D30).
import * as z from "zod";

import { defineConfigModule, definePromptKey } from "../shared/config/index.ts";

export const featuresModule = defineConfigModule({
  key: "features",
  consumer: "ctx",
  owner: "T12",
  setup: "derived",
  description: "Feature switches.",
  schema: z
    .strictObject({
      lavish: z
        .boolean()
        .default(true)
        .meta({ description: "Review in Lavish; false falls back to AskUserQuestion (R-11)." }),
    })
    .prefault({}),
});

export const executionModule = defineConfigModule({
  key: "execution.concurrency",
  consumer: "ctx",
  owner: "T23",
  setup: "default",
  description:
    "The most dispatches of one wave run at once; the swarm skill's context states it (T23-D52).",
  schema: z.int().min(1).max(15).default(5),
});

/** The two texts of the `decision` fragment; the manifest picks one (R-11). */
export const fragmentPrompts = (["lavish", "ask-user"] as const).map((name) =>
  definePromptKey({
    key: `fragments/decision/${name}`,
    consumer: "ctx",
    owner: "T13",
    defaultFile: `fragments/decision/${name}.md`,
  }),
);
