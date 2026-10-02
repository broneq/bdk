// Generates `schema/cli/output/hooks-prompt-expansion.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { PromptExpansionReport } from "../domain/report.ts";

const entryId = z
  .string()
  .regex(/^L-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });

const gate = z
  .strictObject({
    gate: z.string().min(1).meta({ description: "Gate node id, e.g. gate:design." }),
    ready: z.boolean(),
    done: z.boolean(),
    passedBy: z.enum(["user", "policy"]).optional(),
    command: z
      .string()
      .optional()
      .meta({ description: "The stage command the user types to pass it, e.g. /bdk:plan." }),
    pending: z
      .array(z.strictObject({ id: entryId, type: z.string().min(1), summary: z.string().min(1) }))
      .meta({ description: "review: true entries listed, never dispositioned." }),
  })
  .meta({ description: "What the user sees before typing the next stage command (T1)." });

export const promptExpansionOutput = z
  .strictObject({
    decision: z.literal("pass"),
    command: z.string().min(1).meta({
      description:
        "The bare skill name parsed from the namespaced command_name (bdk:plan -> plan); the whole name outside the bdk: namespace.",
    }),
    stage: z.string().min(1).optional().meta({
      description: "The pipeline stage the command names; absent for /bdk:run and other skills.",
    }),
    gate: z.string().min(1).optional().meta({ description: "The gate that opens the stage." }),
    entry: entryId.optional().meta({ description: "The transition written, if any." }),
    wrote: z.enum(["transition:user", "transition:policy", "transition:stage", "none"]),
    skipVerify: z.boolean().optional().meta({
      description: "Whether the stage transition carries skip-verify (only /bdk:execute).",
    }),
    status: gate.optional(),
    passedAt: z.iso.datetime({ precision: 3 }).optional().meta({
      description: "When the gate was passed, for a gate that was already done.",
    }),
    passed: z
      .array(
        z.strictObject({
          gate: z.string().min(1),
          stage: z.string().min(1),
          entry: entryId,
        }),
      )
      .optional()
      .meta({ description: "/bdk:run: the ready auto gates passed by policy." }),
    waiting: z
      .array(gate)
      .optional()
      .meta({ description: "/bdk:run: the ready manual gates the user still types." }),
    run: z
      .strictObject({
        auto: z.boolean().meta({ description: "--auto was the first argument token." }),
        intent: z.boolean().meta({ description: "An intent followed the flags." }),
      })
      .optional()
      .meta({ description: "/bdk:run: the session's run marker was written (T41)." }),
  })
  .meta({
    title: "bdk hooks prompt-expansion --json",
    description:
      "UserPromptExpansion guard: the only writer of `source: user` stage transitions and the start of a run. A block is the error object under --json and <rule>: <why> on stderr otherwise.",
    examples: [
      {
        decision: "pass",
        command: "plan",
        stage: "plan",
        gate: "gate:design",
        entry: "L-g5h2j7qa",
        wrote: "transition:user",
        skipVerify: false,
      },
    ],
  }) satisfies z.ZodType<PromptExpansionReport>;
