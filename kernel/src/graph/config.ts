// The settings the graph reads (`kernel-settings`; design D-9, D-11): the
// `policy.gates` switches, the part size of `plan.part` (#166), the part
// worktrees of `execution.worktree` (T45) and one
// instruction template per artifact kind.
// config.ts imports only shared/config and zod, so the kind names are listed
// here; a unit test keeps the list equal to the kind registry.
import * as z from "zod";

import { defineConfigModule, definePromptKey } from "../shared/config/index.ts";

const gate = z.enum(["manual", "auto"]).default("manual");

export const gatesModule = defineConfigModule({
  key: "policy.gates",
  consumer: "graph",
  owner: "T21",
  setup: "asked",
  description: "How the pipeline proceeds: whether each human gate waits for the user.",
  schema: z
    .strictObject({
      design: gate.meta({ description: "auto lets a policy transition pass gate:design." }),
      review: gate.meta({ description: "auto lets a policy transition pass gate:review." }),
    })
    .prefault({}),
});

export const planPartModule = defineConfigModule({
  key: "plan.part",
  consumer: "graph",
  owner: "T22",
  setup: "default",
  description: "The size of a plan part, which one agent implements whole (#166).",
  schema: z
    .strictObject({
      "max-tasks": z.int().min(1).max(8).default(5).meta({
        description: "Tasks one plan part holds at most (the tasks check).",
      }),
      "max-files": z.int().min(1).max(30).default(10).meta({
        description: "Distinct Files: paths of one plan part at most (the files check).",
      }),
    })
    .prefault({}),
});

export const executionWorktreeModule = defineConfigModule({
  key: "execution.worktree",
  consumer: "graph",
  owner: "T45",
  setup: {
    enabled: "default",
    dir: "default",
    "setup.command": "derived",
    "setup.timeout": "default",
    "max-live": "default",
  },
  description: "Kernel-owned git worktrees of the plan parts with isolation: worktree.",
  schema: z
    .strictObject({
      enabled: z.boolean().default(true).meta({
        description: "false runs a worktree part in the home checkout, alone in its wave.",
      }),
      dir: z.string().min(1).default(".bdk/.machine/worktrees").meta({
        description: "Where worktrees live, against the home project root unless absolute.",
      }),
      setup: z
        .strictObject({
          command: z.string().min(1).optional().meta({
            description: "Shell command run in a new worktree after the .worktreeinclude copy.",
          }),
          timeout: z.int().min(10).max(540).default(300).meta({
            description: "Seconds the setup may run; keeps part start inside a 600 s shell limit.",
          }),
        })
        .prefault({}),
      "max-live": z.int().min(1).max(15).default(3).meta({
        description: "Kernel worktrees alive at once; a later worktree part waits for a wave.",
      }),
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
  "design-verify",
  "plan-part",
  "plan-verify",
  "gate",
  "execute-part",
  "conform",
  "tests-scoped",
  "lint",
  "tests-full",
  "lint-full",
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
