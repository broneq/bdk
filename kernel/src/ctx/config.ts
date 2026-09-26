// The settings `ctx` reads (`kernel-settings`, Keys of the project toolchain,
// Tool entries, Prompt values): the project's languages and commands, the
// Lavish switch, and the rule and fragment texts a project may extend or
// replace.
import * as z from "zod";

import { defineConfigModule, definePromptKey } from "../shared/config/index.ts";

const ID = /^[a-z0-9][a-z0-9-]*$/;

const text = z.string().min(1);
const withFiles = text.regex(/\{files\}/, "must contain the {files} placeholder");

const entryFields = {
  id: z.string().regex(ID, "must be kebab-case: lowercase letters, digits and -").meta({
    description: "Unique within the array; the merge key and the path segment.",
  }),
  command: text.meta({ description: "The full, unscoped command." }),
  scoped: withFiles.optional().meta({ description: "The command for given paths ({files})." }),
  related: withFiles
    .optional()
    .meta({ description: "The command for the tests covering given source paths ({files})." }),
  failed: text.optional().meta({ description: "Re-run of the previous failures." }),
  incremental: text.optional().meta({ description: "The incremental form." }),
  when: text
    .optional()
    .meta({ description: "When this entry is the right one to run; passed to the model as is." }),
};

function tools(tier: z.ZodEnum | undefined, description: string) {
  const entry = (
    tier === undefined ? z.strictObject(entryFields) : z.strictObject({ ...entryFields, tier })
  ).meta({ title: "tool entry" });
  return z.array(entry).default([]).meta({ description });
}

export const languagesModule = defineConfigModule({
  key: "languages",
  consumer: "ctx",
  owner: "T12",
  description:
    "Languages and frameworks of the project; a name gets content from the rules/languages/<name> prompt value.",
  schema: z
    .array(text)
    .refine((names) => new Set(names).size === names.length, "names must be unique")
    .meta({ uniqueItems: true })
    .default([]),
});

export const toolsModule = defineConfigModule({
  key: "tools",
  consumer: "ctx",
  owner: "T12",
  description: "The commands the project runs, one entry per command, merged by id.",
  schema: z
    .strictObject({
      test: tools(z.enum(["fast", "e2e"]), "Test commands; tier fast or e2e."),
      lint: tools(z.enum(["lint", "format", "typecheck"]), "Lint, format and type check commands."),
      build: tools(undefined, "Build commands; no tier."),
    })
    .prefault({}),
});

export const featuresModule = defineConfigModule({
  key: "features",
  consumer: "ctx",
  owner: "T12",
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
      consumer: "ctx",
      owner: "T12",
      defaultFile: `rules/${name}.md`,
    }),
  ),
  definePromptKey({
    key: "rules/languages/*",
    consumer: "ctx",
    owner: "T12",
    defaultFile: "rules/languages/{name}.md",
  }),
];

/** The two texts of the `decision` fragment; the manifest picks one (R-11). */
export const fragmentPrompts = (["lavish", "ask-user"] as const).map((name) =>
  definePromptKey({
    key: `fragments/decision/${name}`,
    consumer: "ctx",
    owner: "T13",
    defaultFile: `fragments/decision/${name}.md`,
  }),
);
