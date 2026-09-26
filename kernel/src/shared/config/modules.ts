// The module `shared/config` consumes itself (`kernel-settings`, Keys of
// prompt locations): where each layer keeps its prompt files.
import * as z from "zod";

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
