// Generates `schema/cli/output/review-plan.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import type { ReviewPlan } from "../domain/plan.ts";

const sha = z.string().regex(/^[0-9a-f]{40}$/);
const count = z.int().min(0);
const path = z.string().min(1);
const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const group = z.strictObject({
  id: kebab.meta({
    description: "`p<nn>`, `unplanned`, `m<k>` or `integration`; a split group adds `-<k>`.",
  }),
  kind: z.enum(["part", "unplanned", "module", "integration"]),
  part: z
    .string()
    .regex(/^\d{2}$/)
    .optional()
    .meta({ description: "Only on a `part` group: the plan part number." }),
  files: z.array(path).meta({ description: "Sorted repository-relative paths." }),
});

export const reviewPlanOutput = z
  .strictObject({
    change: z.string().min(1),
    anchor: z.strictObject({
      kind: z.enum(["delta", "full", "base"]).meta({
        description:
          "`delta`: the head of the latest merged review; `full`: the Change base; `base`: the merge base with `--base`.",
      }),
      sha: sha.meta({
        description: "The anchor commit, or the empty tree for a Change opened by the root commit.",
      }),
    }),
    head: sha.meta({ description: "The reviewed commit, `HEAD`." }),
    range: z.string().min(1).meta({ description: "`<anchor>..<head>`, committed history only." }),
    dirty: z.array(path).meta({
      description:
        "Tracked files outside `.bdk/` with uncommitted changes; the groups leave them out.",
    }),
    measure: z
      .strictObject({ files: count, added: count, removed: count, modules: z.array(path) })
      .meta({ description: "The range's signals as `bdk measure` returns them." }),
    groups: z.array(group).meta({
      description:
        "Parts (or modules without a plan), `unplanned`, then `integration`; empty for an empty range.",
    }),
  })
  .meta({
    title: "bdk review plan --json",
    description:
      "Compute the range and the reviewer groups of the next review round of the active Change.",
    examples: [
      {
        change: "2026-09-25-passwordless-login",
        anchor: { kind: "delta", sha: "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2" },
        head: "9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
        range: "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2..9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
        dirty: [],
        measure: { files: 3, added: 120, removed: 14, modules: ["src/auth", "src/mail"] },
        groups: [
          {
            id: "p01",
            kind: "part",
            part: "01",
            files: ["src/auth/login.test.ts", "src/auth/login.ts"],
          },
          { id: "unplanned", kind: "unplanned", files: ["src/mail/send.ts"] },
          {
            id: "integration",
            kind: "integration",
            files: ["src/auth/login.test.ts", "src/auth/login.ts", "src/mail/send.ts"],
          },
        ],
      },
    ],
  }) satisfies z.ZodType<ReviewPlan>;
