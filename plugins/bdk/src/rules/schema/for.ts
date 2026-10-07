// The `--json` result of `bdk rules for` (spec `bdk-cli/rules`, "Rules output").

import { z } from "zod";

import { KINDS, ORIGINS, STAGES } from "../domain/rule.ts";

export const forSchema = z.strictObject({
  stage: z.enum(STAGES),
  files: z.array(z.string()),
  rules: z.array(
    z.strictObject({
      id: z.string(),
      origin: z.enum(ORIGINS),
      kind: z.enum(KINDS),
      language: z.string().nullable(),
      file: z.string(),
      paths: z.array(z.string()),
      stages: z.array(z.enum(STAGES)),
      source: z.string().nullable(),
      verified: z.string().nullable(),
      matched: z.array(z.string()),
      text: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type ForResult = z.infer<typeof forSchema>;
