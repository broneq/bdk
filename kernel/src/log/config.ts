// The settings `log` reads (`kernel-settings`, Keys of workflow policy; P8,
// T23-D34): the closed list of blocking categories for the verifier roles and
// the list of what is never a blocker. `log add` downgrades a verifier blocker
// outside the first list; `dispatch` puts both lists in a verifier's package.
import * as z from "zod";

import { defineConfigModule } from "../shared/config/index.ts";

const ID = /^[a-z0-9][a-z0-9-]*$/;

const item = (description: string) =>
  z
    .strictObject({
      id: z.string().regex(ID, "must be kebab-case: lowercase letters, digits and -").meta({
        description: "Unique within the array; the merge key.",
      }),
      description: z.string().min(1),
    })
    .meta({ title: "category entry", description });

const BLOCKING = [
  {
    id: "architecture",
    description: "Materially invalid architecture, or a contradiction with an accepted decision.",
  },
  { id: "security", description: "A security, privacy or authentication risk." },
  {
    id: "irreversible-step",
    description:
      "An irreversible or high-cost step without justification, such as a migration or data loss.",
  },
  {
    id: "integration-failure",
    description: "A critical integration, data, rollout or rollback failure.",
  },
  {
    id: "unresolved-decision",
    description: "An execution-critical unresolved decision or omitted requirement.",
  },
  { id: "false-code-claim", description: "A claim about the real code that is false." },
];

const NOT_A_FAIL = [
  { id: "style", description: "Style." },
  { id: "template-conformance", description: "Template conformance." },
  { id: "files-bookkeeping", description: "`Files:` bookkeeping." },
  { id: "wording", description: "Wording." },
  { id: "report-length", description: "Report length." },
  {
    id: "verification-defect",
    description:
      "A verification defect, unless it removes the only real evidence of the change's safety.",
  },
];

export const verifierModule = defineConfigModule({
  key: "policy.verifier",
  consumer: "log",
  owner: "T23",
  description:
    "What a verifier may block on (P8): a blocker outside blocking-categories is downgraded to a reviewed observation.",
  schema: z
    .strictObject({
      "blocking-categories": z
        .array(item("A category a verifier or design-verifier blocker may name."))
        .default(BLOCKING)
        .meta({ description: "Merged by id; replace the array to disable a category." }),
      "not-a-fail": z
        .array(item("Something a verifier never blocks on."))
        .default(NOT_A_FAIL)
        .meta({
          description: "Merged by id; shown in a verifier's package next to the categories.",
        }),
    })
    .prefault({}),
});
