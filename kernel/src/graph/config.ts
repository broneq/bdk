// The settings the graph reads (`kernel-settings`; design D-9, D-11): the
// `policy.gates` switches, the `execution.tree` rule of the execute wave
// (T41-D3), the part worktrees of `execution.worktree` (T45) and one
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

export const executionTreeModule = defineConfigModule({
  key: "execution.tree",
  consumer: "graph",
  owner: "T41",
  setup: "default",
  description: "When bdk next marks a part of the execute wave tree: one lead per part.",
  schema: z
    .strictObject({
      enabled: z.boolean().default(true).meta({
        description: "false runs every part flat, the main thread dispatching its tasks.",
      }),
      "min-parts": z.int().min(2).max(15).default(2).meta({
        description: "Ready parts not started a large Change needs before they run as a tree.",
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
  "simplify",
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
