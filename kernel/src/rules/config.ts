// The settings `rules` owns (`kernel-settings`, Keys of the project toolchain,
// Prompt values; T23-D30): the project's languages and the rule texts a
// project may extend or replace. `ctx` and `dispatch` read them through
// this slice's `index.ts`.
import * as z from "zod";

import { defineConfigModule, definePromptKey } from "../shared/config/index.ts";

const text = z.string().min(1);

export const languagesModule = defineConfigModule({
  key: "languages",
  consumer: "rules",
  owner: "T12",
  description:
    "Languages and frameworks of the project; a name gets content from the rules/languages/<name> prompt value.",
  schema: z
    .array(text)
    .refine((names) => new Set(names).size === names.length, "names must be unique")
    .meta({ uniqueItems: true })
    .default([]),
});

const RULE_CATEGORIES = [
  "code-quality",
  "architecture",
  "design-patterns",
  "security",
  "engineering-judgment",
  "test-quality",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const rulePrompts = [
  ...RULE_CATEGORIES.map((name) =>
    definePromptKey({
      key: `rules/${name}`,
      consumer: "rules",
      owner: "T12",
      defaultFile: `rules/${name}.md`,
    }),
  ),
  definePromptKey({
    key: "rules/languages/*",
    consumer: "rules",
    owner: "T12",
    defaultFile: "rules/languages/{name}.md",
  }),
];
