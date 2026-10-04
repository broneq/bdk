// The settings `dispatch` reads (`kernel-settings`, Keys of review policy,
// Prompt values): the risky areas the integration reviewer's package lists
// (T42-K), instructions to a model merged by id, and the merge-conflict
// instruction of a merge ticket (T45).
import * as z from "zod";

import { defineConfigModule, definePromptKey } from "../shared/config/index.ts";

/**
 * The project's instruction for resolving merge conflicts, copied into the
 * `Conflict` section of a merge ticket's package (`kernel-settings`, Prompt
 * values; T45). It names no BDK flow, so any merge can reuse it.
 */
export const mergeConflictsPrompt = definePromptKey({
  key: "fragments/merge-conflicts",
  consumer: "dispatch",
  owner: "T45",
  defaultFile: "fragments/merge-conflicts.md",
});

const RISKS = [
  {
    id: "auth",
    instruction:
      "Changes to authentication, authorisation, permissions, roles or session handling, including who may call a changed endpoint.",
  },
  {
    id: "migration",
    instruction:
      "Changes to a persistent data model: schema migrations, stored formats, data backfills, anything hard to roll back.",
  },
  {
    id: "secrets",
    instruction:
      "Code or configuration that reads, stores, logs or transmits secrets, tokens, keys or personal data.",
  },
  {
    id: "public-api",
    instruction:
      "Changes to a public or cross-service interface: endpoints, exported functions, CLI flags, events, file formats others consume.",
  },
  {
    id: "dependencies",
    instruction:
      "Added, removed or upgraded third-party dependencies and changes to build or deployment configuration.",
  },
] as const;

const risk = z
  .strictObject({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case")
      .meta({
        description: "The merge key.",
      }),
    instruction: z.string().min(1).max(500).meta({
      description: "What a reviewer must call out, written for a model.",
    }),
    enabled: z.boolean().default(true).meta({ description: "false leaves the item out." }),
  })
  .meta({ title: "risk" });

export const risksModule = defineConfigModule({
  key: "review.risks",
  consumer: "dispatch",
  owner: "T42",
  description: "Risky areas of this project the integration reviewer calls out, merged by id.",
  schema: z
    .array(risk)
    .default(RISKS.map((item) => ({ ...item, enabled: true })))
    .meta({ description: "Items {id, instruction, enabled}, merged by id with the defaults." }),
});
