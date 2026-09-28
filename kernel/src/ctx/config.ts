// The settings `ctx` reads (`kernel-settings`, Keys of the project toolchain,
// Tool entries, Prompt values): the project's commands, the Lavish switch and
// the fragment texts a project may extend or replace. The rule texts and
// `languages` belong to `rules` (T23-D30).
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

export const executionModule = defineConfigModule({
  key: "execution",
  consumer: "ctx",
  owner: "T23",
  description: "How the orchestrator runs the dispatches of one wave.",
  schema: z
    .strictObject({
      concurrency: z.int().min(1).max(15).default(5).meta({
        description:
          "The most dispatches of one wave run at once; the swarm skill's context states it (T23-D52).",
      }),
    })
    .prefault({}),
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
