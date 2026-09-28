// Generates `schema/cli/output/spec-{delta-check,merge,diff}.json`
// (kernel/scripts/export-schemas.ts), replacing the hand-written T11 shapes.
import * as z from "zod";

import { PROBLEM_CODES } from "../domain/reports.ts";
import type { CheckReport, DiffReport, MergeReport } from "../domain/reports.ts";

const CHANGE_DIR = ".bdk/changes/2026-09-25-passwordless-login";
const path = z.string().min(1).meta({ description: "Path relative to the project root." });
const capability = z
  .string()
  .min(1)
  .meta({ description: "The capability path, e.g. `auth/login`." });
const count = z.int().min(0);

export const specDeltaCheckOutput = z
  .strictObject({
    valid: z.literal(true).meta({
      description: "Always true: a delta with a problem refuses with `policy/spec-invalid`.",
    }),
    deltas: z.array(
      z.strictObject({
        capability,
        path,
        valid: z.boolean(),
        problems: z.array(
          z.strictObject({
            line: z.int().min(1).meta({ description: "1-based line in the delta." }),
            code: z.enum(PROBLEM_CODES),
            message: z.string().min(1),
          }),
        ),
      }),
    ),
  })
  .meta({
    title: "bdk spec delta check --json",
    description: "Validate a spec delta: Scenario prefix, WHEN / THEN, no silent scenario loss.",
    examples: [
      {
        valid: true,
        deltas: [
          {
            capability: "auth/login",
            path: `${CHANGE_DIR}/spec-delta/auth/login.md`,
            valid: true,
            problems: [],
          },
        ],
      },
    ],
  }) satisfies z.ZodType<CheckReport>;

export const specMergeOutput = z
  .strictObject({
    merged: z.array(
      z.strictObject({
        capability,
        path,
        mergeHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
        added: count.meta({ description: "ADDED requirements of the delta." }),
        modified: count.meta({
          description: "MODIFIED requirements plus REMOVED entries listing only scenarios.",
        }),
        removed: count.meta({ description: "Requirements REMOVED as a whole." }),
      }),
    ),
    conflicts: z
      .array(
        z.strictObject({
          capability,
          requirement: z.string().min(1),
          ours: z.string().min(1).meta({ description: "This Change's block." }),
          theirs: z.string().min(1).meta({
            description: "The archived Change's block, prefixed by its id and `: `.",
          }),
        }),
      )
      .meta({ description: "Listed by `--dry-run`; without it a conflict refuses." }),
  })
  .meta({
    title: "bdk spec merge --json",
    description:
      "Deterministically merge the Change's deltas into `.bdk/specs/`; refuse on conflict.",
    examples: [
      {
        merged: [
          {
            capability: "auth/login",
            path: ".bdk/specs/auth/login/spec.md",
            mergeHash: `sha256:${"6".repeat(64)}`,
            added: 2,
            modified: 1,
            removed: 0,
          },
        ],
        conflicts: [],
      },
    ],
  }) satisfies z.ZodType<MergeReport>;

export const specDiffOutput = z
  .strictObject({
    capabilities: z.array(
      z.strictObject({
        capability,
        requirements: z.array(
          z.strictObject({
            name: z.string().min(1),
            change: z.enum(["added", "modified", "removed"]).meta({
              description: "`modified` covers a REMOVED entry listing only scenarios.",
            }),
            scenarios: z.strictObject({ added: count, removed: count }),
          }),
        ),
      }),
    ),
  })
  .meta({
    title: "bdk spec diff --json",
    description:
      "What the merged spec would look like: requirement-level diff of the Change's deltas against `.bdk/specs/`.",
    examples: [
      {
        capabilities: [
          {
            capability: "auth/login",
            requirements: [
              { name: "Magic link expires", change: "added", scenarios: { added: 2, removed: 0 } },
            ],
          },
        ],
      },
    ],
  }) satisfies z.ZodType<DiffReport>;
