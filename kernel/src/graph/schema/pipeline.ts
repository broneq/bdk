// The strict schema of `pipeline/pipeline.yaml` (`kernel-pipeline`, Pipeline
// file; design D-1). `kernel/scripts/export-schemas.ts` generates
// `schema/pipeline.json` from it, so the editor and the kernel check the same
// shape. Cross-references (kinds, stages, requires, settings) are checked by
// `pipelineProblems`, which needs the registries.
import * as z from "zod";

import { LOOPS } from "../domain/pipeline.ts";
import type { Pipeline } from "../domain/pipeline.ts";
import { CHANGE_KINDS, PROFILES } from "../../shared/vocabulary/index.ts";

const KEBAB = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";
const kebab = z.string().regex(new RegExp(`^${KEBAB}$`), "must be kebab-case");

const stage = z.strictObject({
  id: kebab.meta({ description: "Stage id, in pipeline order." }),
  command: z
    .string()
    .regex(/^\/bdk:[a-z][a-z0-9-]*$/, "must be a /bdk:<skill> command")
    .meta({ description: "The stage command a user types, e.g. /bdk:plan." }),
});

const node = z
  .strictObject({
    id: z
      .string()
      .regex(new RegExp(`^(?:${KEBAB}|gate:${KEBAB})$`), "must be kebab-case or gate:<stage>")
      .meta({ description: "Unique; a collection names its instances <kind>:<nn>." }),
    kind: kebab.meta({ description: "A registered artifact kind." }),
    stage: kebab.meta({ description: "A stage id of this file." }),
    requires: z
      .array(z.string().min(1))
      .optional()
      .meta({ description: "Node ids of this file; the graph is acyclic. Default empty." }),
    profiles: z
      .array(z.enum(PROFILES))
      .min(1)
      .optional()
      .meta({ description: "The node exists only for these effective profiles. Default all." }),
    kinds: z
      .array(z.enum(CHANGE_KINDS))
      .min(1)
      .optional()
      .meta({ description: "The node exists only for these Change kinds. Default all." }),
    if: z
      .string()
      .regex(new RegExp(`^features\\.${KEBAB}$`), "only features.<name> is accepted")
      .optional()
      .meta({ description: "features.<name>: the node exists only while the switch is true." }),
    budget: z
      .enum(LOOPS)
      .optional()
      .meta({ description: "The loop whose policy.budgets value bounds this node (T22)." }),
    policy: kebab
      .optional()
      .meta({ description: "Gate only: the policy.gates key that makes it manual or auto." }),
    opens: kebab
      .optional()
      .meta({ description: "Gate only: the stage whose command passes the gate." }),
  })
  .meta({ title: "pipeline node" });

export const pipelineSchema = z
  .strictObject({
    schema: z.literal(1).meta({ description: "Version of this file's format." }),
    stages: z.array(stage).min(1),
    nodes: z.array(node).min(1).meta({ description: "In pipeline order, the order next walks." }),
  })
  .meta({
    title: "BDK pipeline",
    description:
      "The artifact graph of a Change: stages and nodes. No expression but if: features.<name>, no loop, no path.",
  }) satisfies z.ZodType<Pipeline>;
