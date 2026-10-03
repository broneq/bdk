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

// How one test type measures coverage (T42): its own run, report and format,
// and the threshold `bdk evidence coverage` applies to the lines a Change adds.
const coverage = z
  .strictObject({
    command: text.meta({ description: "The full run that writes the coverage report." }),
    report: text
      .refine((value) => !/^(\/|[A-Za-z]:[\\/])/.test(value), "must be relative, not absolute")
      .meta({ description: "Where the command writes the report, relative to the project root." }),
    format: z.enum(["lcov", "cobertura"]).meta({ description: "The report format." }),
    min: z.number().min(0).max(100).optional().meta({
      description: "The least coverage, in percent, of the lines a Change adds; none only reports.",
    }),
  })
  .meta({ title: "coverage" });

function tools(tier: z.ZodEnum | undefined, description: string, extra: z.ZodRawShape = {}) {
  const entry = (
    tier === undefined
      ? z.strictObject({ ...entryFields, ...extra })
      : z.strictObject({ ...entryFields, ...extra, tier })
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
      test: tools(z.enum(["fast", "e2e"]), "Test commands; tier fast or e2e.", {
        coverage: coverage.optional(),
      }),
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
  key: "execution.concurrency",
  consumer: "ctx",
  owner: "T23",
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
