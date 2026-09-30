// The settings `rules` owns (`kernel-settings`, Keys of the project toolchain,
// Keys of rules and specs): the project's languages, which select the
// bundle's language packs, and the `rules` keys of selection and the audit.
// Rules themselves are files, not prompt values (T31).
import * as z from "zod";

import { defineConfigModule, RULE_ID } from "../shared/config/index.ts";

const text = z.string().min(1);
const count = z.int().min(1);

export const languagesModule = defineConfigModule({
  key: "languages",
  consumer: "rules",
  owner: "T12",
  description:
    "Languages and frameworks of the project; a name selects the bundle's pack rules/languages/<name>/.",
  schema: z
    .array(text)
    .refine((names) => new Set(names).size === names.length, "names must be unique")
    .meta({ uniqueItems: true })
    .default([]),
});

export const rulesModule = defineConfigModule({
  key: "rules",
  consumer: "rules",
  owner: "T31",
  description: "Rule selection per dispatch package and the audit view of rules stats.",
  schema: z
    .strictObject({
      "warn-above": count.default(100).meta({
        description:
          "Rules one role may read before hooks session-start warns; no cap, every applying rule reaches the agent.",
      }),
      disabled: z
        .array(z.string().regex(RULE_ID))
        .refine((ids) => new Set(ids).size === ids.length, "ids must be unique")
        .meta({ uniqueItems: true, description: "Rule ids switched off, BDK ones included." })
        .default([]),
      audit: z
        .strictObject({
          "min-changes": count.default(3).meta({
            description: "Distinct Changes an item must appear in to be listed as recurring.",
          }),
        })
        .prefault({}),
      prune: z
        .strictObject({
          "uncited-changes": count.default(20).meta({
            description: "Recent Changes rules prune looks back for citations.",
          }),
        })
        .prefault({}),
    })
    .prefault({}),
});
