// The settings the graph reads (`kernel-settings`; design D-9, D-11): the
// `policy.gates` switches and one instruction template per artifact kind.
// config.ts imports only shared/config and zod, so the kind names are listed
// here; a unit test keeps the list equal to the kind registry.
import * as z from "zod";

import { defineConfigModule, definePromptKey } from "../shared/config/index.ts";

const gate = z.enum(["manual", "auto"]).default("manual");

export const policyModule = defineConfigModule({
  key: "policy",
  consumer: "graph",
  owner: "T21",
  description: "How the pipeline proceeds: whether each human gate waits for the user.",
  schema: z
    .strictObject({
      gates: z
        .strictObject({
          design: gate.meta({ description: "auto lets a policy transition pass gate:design." }),
          review: gate.meta({ description: "auto lets a policy transition pass gate:review." }),
        })
        .prefault({}),
    })
    .prefault({}),
});

/** The registered artifact kinds (`kernel-pipeline`, Artifact kinds). */
export const KIND_NAMES = [
  "intent",
  "design",
  "architecture",
  "design-part",
  "design-index",
  "plan-part",
  "plan-verify",
  "gate",
  "execute-part",
  "post-task-step",
  "review",
  "spec-delta",
  "close",
] as const;

function pipelinePrompt(kind: string) {
  return definePromptKey({
    key: `pipeline/${kind}`,
    consumer: "graph",
    owner: "T21",
    defaultFile: `pipeline/${kind}.md`,
  });
}

export const pipelinePrompts = KIND_NAMES.map(pipelinePrompt);
