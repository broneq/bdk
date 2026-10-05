// The modules `shared/config` declares itself (`kernel-settings`, Keys of
// prompt locations, Keys of the project toolchain): where each layer keeps
// its prompt files, and the project's commands, which `ctx`, `dispatch`,
// `evidence` and `graph` all read, so no one slice owns them.
import * as z from "zod";

import type { ToolGroupName, ToolGroupState } from "../vocabulary/index.ts";

import { defineConfigModule } from "./registry.ts";

const glob = z
  .string()
  .min(1)
  .refine((value) => !/^(\/|[A-Za-z]:[\\/])/.test(value), "must be relative, not absolute")
  .refine((value) => !value.split("/").includes(""), "must not hold an empty path segment");

const promptFile = z.union([
  z.string().min(1),
  z.strictObject({
    path: z.string().min(1),
    mode: z.enum(["extends", "replace"]).optional(),
    applies: z.array(glob).optional(),
  }),
]);

export const promptsModule = defineConfigModule({
  key: "prompts",
  consumer: "shared/config",
  owner: "T12",
  description: "Where prompt values come from: a directory per layer and single mapped files.",
  schema: z
    .strictObject({
      dir: z.string().min(1).optional().meta({
        description:
          "This layer's prompts directory; read from each layer's own file, never inherited.",
      }),
      files: z.record(z.string(), promptFile).optional().meta({
        description:
          "Prompt key -> a file path, or {path, mode, applies}; wins over the directory in the same layer.",
      }),
    })
    .prefault({}),
});

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

function entry<S extends z.ZodRawShape>(shape: S) {
  return z.strictObject({ ...entryFields, ...shape }).meta({ title: "tool entry" });
}

function tools<T extends z.ZodType>(item: T, description: string) {
  return z.array(item).default([]).meta({ description });
}

/** The scalar that declares a tool group not used (T49). */
export const NONE = "none";

const GROUP_MESSAGE = `must be ${NONE} or a list of at least one entry; set ${NONE} when the project has no tool of this group`;

/**
 * A tool group the pipeline runs (`kernel-settings`, Tool entries; T49): a list
 * of one or more entries, or `none`, without a default, so an unset group stays
 * distinguishable from a declared-none one.
 */
function group<T extends z.ZodType>(item: T, description: string) {
  return z
    .union([z.literal(NONE), z.array(item).min(1, GROUP_MESSAGE)], { error: GROUP_MESSAGE })
    .optional()
    .meta({ description });
}

export const toolsModule = defineConfigModule({
  key: "tools",
  consumer: "shared/config",
  owner: "T12",
  description: "The commands the project runs, one entry per command, merged by id.",
  schema: z
    .strictObject({
      test: group(
        entry({ coverage: coverage.optional(), tier: z.enum(["fast", "e2e"]) }),
        "Test commands, tier fast or e2e; none when the project has no test tool.",
      ),
      lint: group(
        entry({ tier: z.enum(["lint", "format", "typecheck"]) }),
        "Lint, format and type check commands; none when the project has no lint tool.",
      ),
      build: tools(entry({}), "Build commands; no tier."),
    })
    .prefault({}),
});

/** The resolved `tools` entries (`kernel-settings`, Tool entries). */
export type ToolEntries = z.output<typeof toolsModule.schema>;

export type ToolEntry<G extends ToolGroupName> = Exclude<
  ToolEntries[G],
  typeof NONE | undefined
>[number];

/** A tool group's state and its entries, empty unless configured. */
export function toolGroup<G extends ToolGroupName>(
  tools: ToolEntries,
  name: G,
): { readonly state: ToolGroupState; readonly entries: readonly ToolEntry<G>[] } {
  const value = tools[name];
  if (value === undefined) return { state: "unset", entries: [] };
  if (value === NONE) return { state: "none", entries: [] };
  return { state: "configured", entries: value };
}

/** The state of every tool group (T49). */
export function toolGroupStates(tools: ToolEntries): Record<ToolGroupName, ToolGroupState> {
  return { test: toolGroup(tools, "test").state, lint: toolGroup(tools, "lint").state };
}
