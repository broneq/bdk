// The settings the loops read (`kernel-settings`, Keys of workflow policy;
// `kernel-loops`): the budget of each loop, the oscillation threshold and the
// escalation rung. Each subtree of `policy` is its own module.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

const budget = (value: number, description: string) =>
  z.int().min(0).default(value).meta({ description });

export const budgetsModule = defineConfigModule({
  key: "policy.budgets",
  consumer: "attempt",
  owner: "T22",
  setup: "default",
  description: "How many tickets each loop may open in one round before the ladder moves on.",
  schema: z
    .strictObject({
      part: budget(3, "Tickets of one plan part, each one implementer and one conformer (#166)."),
      "verify-fix": budget(2, "Fix rounds after a failed verification of one part."),
      "review-fix": budget(2, "Fix rounds after the review of the Change."),
      verifier: budget(2, "Iterations of one verifier over one artifact."),
      "not-run": budget(3, "Consecutive not-run closes of one loop and target."),
    })
    .prefault({}),
});

export const oscillationModule = defineConfigModule({
  key: "policy.oscillation",
  consumer: "attempt",
  owner: "T22",
  setup: "default",
  description: "When a finding that keeps coming back shortens the ladder.",
  schema: z
    .strictObject({
      threshold: z.int().min(1).default(2).meta({
        description: "Fail records of one round that carry the same fingerprint.",
      }),
    })
    .prefault({}),
});

export const escalationModule = defineConfigModule({
  key: "policy.escalation",
  consumer: "attempt",
  owner: "T22",
  setup: "default",
  description: "The one-shot escalation ticket with a fresh context and a stronger model.",
  schema: z
    .strictObject({
      enabled: z.boolean().default(true).meta({ description: "false skips the escalation rung." }),
      model: z.string().min(1).default("opus").meta({
        description: "The model class the escalation ticket names; the dispatch adapter maps it.",
      }),
      "per-change": z.int().min(0).default(3).meta({
        description: "Escalation tickets one Change may open in total.",
      }),
    })
    .prefault({}),
});
