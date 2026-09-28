// Generates `schema/cli/output/part-{list,start,done,split}.json`
// (kernel/scripts/export-schemas.ts), replacing the hand-written T11 shapes.
import * as z from "zod";

import { PART_STATES } from "../domain/reports.ts";
import type {
  PartDoneReport,
  PartListReport,
  PartSplitReport,
  PartStartReport,
} from "../domain/reports.ts";

const entryId = z
  .string()
  .regex(/^L-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const partId = z.string().regex(/^\d{2}$/);
const taskId = z.string().regex(/^\d{2}-[1-9]\d*$/);
const count = z.int().min(0);

export const partListOutput = z
  .strictObject({
    items: z.array(
      z.strictObject({
        part: partId,
        title: z.string().min(1),
        state: z.enum(PART_STATES).meta({
          description:
            "The `execute-part` node state; `ready` shows as `started` once `part start` ran.",
        }),
        tasks: count,
        done: count.meta({ description: "Tasks with a trailer commit reachable from HEAD." }),
        bytes: count.meta({
          description: "Size of the part file; an oversized part is listed, not hidden.",
        }),
        dependsOn: z.array(partId).optional(),
        specImpact: z.enum(["none", "delta"]),
        wave: z.int().min(1).optional().meta({
          description: "From the plan index rule; absent when the dependencies form no plan.",
        }),
      }),
    ),
    total: count,
    truncated: z.boolean(),
  })
  .meta({
    title: "bdk part list --json",
    description: "Plan parts with state, task counts, size, dependencies and wave.",
    examples: [
      {
        items: [
          {
            part: "01",
            title: "Token service",
            state: "done",
            tasks: 4,
            done: 4,
            bytes: 5120,
            specImpact: "delta",
            wave: 1,
          },
          {
            part: "02",
            title: "Login endpoint",
            state: "started",
            tasks: 3,
            done: 1,
            bytes: 4210,
            dependsOn: ["01"],
            specImpact: "none",
            wave: 2,
          },
        ],
        total: 2,
        truncated: false,
      },
    ],
  }) satisfies z.ZodType<PartListReport>;

export const partStartOutput = z
  .strictObject({
    part: partId,
    state: z.literal("started"),
    tasks: z.array(
      z.strictObject({
        task: taskId,
        files: z.array(z.string().meta({ description: "Path relative to the project root." })),
        stopRule: z.string().optional(),
        verification: z.literal("none").optional(),
      }),
    ),
    doNotTouch: z.array(z.string()),
    successMeasure: z.string(),
    entry: entryId,
  })
  .meta({
    title: "bdk part start --json",
    description:
      "Validate a part and record the start transition; required before its first ticket.",
    examples: [
      {
        part: "02",
        state: "started",
        tasks: [
          { task: "02-1", files: ["src/auth/login.ts"] },
          { task: "02-2", files: ["src/auth/login.test.ts"] },
        ],
        doNotTouch: ["src/billing/**"],
        successMeasure: "POST /login returns a session for a valid magic link",
        entry: "L-r2v8k4mn",
      },
    ],
  }) satisfies z.ZodType<PartStartReport>;

export const partDoneOutput = z
  .strictObject({
    part: partId,
    state: z.literal("done"),
    commits: z.array(
      z.strictObject({
        task: taskId,
        commit: z
          .string()
          .regex(/^[0-9a-f]{7}$/)
          .meta({ description: "Abbreviated commit." }),
      }),
    ),
    openFindings: z.array(entryId).meta({
      description: "Live findings naming the part or its tasks; they do not block.",
    }),
    entry: entryId,
    next: z.string().optional().meta({
      description: "The node `bdk next` returns afterwards; absent when none.",
    }),
  })
  .meta({
    title: "bdk part done --json",
    description: "Close a part: every task has a trailer commit and no ticket is open.",
    examples: [
      {
        part: "02",
        state: "done",
        commits: [
          { task: "02-1", commit: "b4d2e1f" },
          { task: "02-2", commit: "c7a9d30" },
        ],
        openFindings: [],
        entry: "L-y5u3e7wq",
        next: "execute-part:03",
      },
    ],
  }) satisfies z.ZodType<PartDoneReport>;

export const partSplitOutput = z
  .strictObject({
    part: partId,
    newPart: partId,
    moved: z.array(taskId).min(1),
    entry: entryId,
  })
  .meta({
    title: "bdk part split --json",
    description: "Split an oversized or parked part into two parts with the same dependencies.",
    examples: [{ part: "02", newPart: "05", moved: ["02-3", "02-4"], entry: "L-n1b7c5xz" }],
  }) satisfies z.ZodType<PartSplitReport>;
