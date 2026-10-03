// Generates `schema/cli/output/evidence-{record,coverage,check}.json`
// (kernel/scripts/export-schemas.ts), replacing the hand-written T11 shapes.
import * as z from "zod";

import type { CheckReport, CoverageReport, RecordReport } from "../domain/reports.ts";

const CHANGE_DIR = ".bdk/changes/2026-09-25-passwordless-login";

const evidenceId = z
  .string()
  .regex(/^E-[0-9a-z]{8}$/)
  .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });
const hash = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const path = z.string().min(1).meta({ description: "Path relative to the project root." });
const verdict = z.enum(["pass", "fail", "not-run"]);

export const evidenceRecordOutput = z
  .strictObject({
    evidence: evidenceId,
    path: path.meta({ description: "The manifest, relative to the project root." }),
    treeHash: hash.meta({ description: "The tree hash of the ticket's target at capture." }),
    files: z
      .array(
        z.strictObject({
          path,
          hash,
          stored: z.enum(["committed", "machine"]).meta({
            description:
              "`committed`: copied into the Change's `evidence/`; `machine`: under `.bdk/.machine/evidence/`, referenced by hash.",
          }),
        }),
      )
      .min(1),
    verdict: verdict.optional(),
    citations: z.array(z.string().min(1)).optional(),
    deduplicated: z.boolean().meta({
      description: "True when an equal manifest existed: it is returned and nothing was written.",
    }),
  })
  .meta({
    title: "bdk evidence record --json",
    description:
      "Register verification evidence: a manifest with the tree hash and the hashes of the files.",
    examples: [
      {
        evidence: "E-b6n9t2kq",
        path: `${CHANGE_DIR}/evidence/02-3-E-b6n9t2kq.md`,
        treeHash: `sha256:${"3".repeat(64)}`,
        files: [
          {
            path: `${CHANGE_DIR}/evidence/02-3-E-b6n9t2kq-02-3-tests.json`,
            hash: `sha256:${"4".repeat(64)}`,
            stored: "committed",
          },
        ],
        verdict: "pass",
        citations: ["/summary/failed"],
        deduplicated: false,
      },
    ],
  }) satisfies z.ZodType<RecordReport>;

export const evidenceCheckOutput = z
  .strictObject({
    fresh: z.boolean().meta({
      description: "True when at least one manifest is checked and every checked one is fresh.",
    }),
    treeHash: hash.meta({ description: "The current tree hash of the target." }),
    evidence: z.array(
      z.strictObject({
        evidence: evidenceId,
        kind: z.string().min(1),
        treeHash: hash.meta({ description: "The tree hash the manifest recorded." }),
        fresh: z.boolean(),
        verdict: verdict.optional(),
        changedSince: z.array(path).meta({
          description: "The covered paths whose hash differs from the manifest's `tree`.",
        }),
      }),
    ),
  })
  .meta({
    title: "bdk evidence check --json",
    description: "Is the evidence for a target still fresh against the working tree?",
    examples: [
      {
        fresh: false,
        treeHash: `sha256:${"5".repeat(64)}`,
        evidence: [
          {
            evidence: "E-b6n9t2kq",
            kind: "tests-scoped",
            treeHash: `sha256:${"3".repeat(64)}`,
            fresh: false,
            verdict: "pass",
            changedSince: ["src/auth/login.ts"],
          },
        ],
      },
    ],
  }) satisfies z.ZodType<CheckReport>;

export const evidenceCoverageOutput = z
  .strictObject({
    evidence: evidenceId.meta({ description: "The `coverage` manifest." }),
    tool: z.string().min(1).meta({ description: "The `tools.test` id measured." }),
    min: z.number().min(0).max(100).nullable().meta({
      description: "The entry's `coverage.min`; null when it only reports.",
    }),
    percent: z.number().min(0).max(100).nullable().meta({
      description:
        "Covered added lines over instrumented added lines, rounded down to one decimal; null when none is instrumented.",
    }),
    covered: z.int().min(0),
    total: z.int().min(0).meta({ description: "The added lines the report instruments." }),
    unmeasured: z.array(path).meta({
      description: "Changed executable files the report does not name; not in `total`.",
    }),
    verdict: z.enum(["pass", "fail"]).meta({
      description:
        "`fail` only when `min` is set, `total` is above 0 and `percent` is below `min`.",
    }),
  })
  .meta({
    title: "bdk evidence coverage --json",
    description:
      "Measure the coverage of the lines the Change added from a test tool's coverage report, and record it with the computed verdict.",
    examples: [
      {
        evidence: "E-c8v6b4n2",
        tool: "unit",
        min: 90,
        percent: 93.7,
        covered: 118,
        total: 126,
        unmeasured: [],
        verdict: "pass",
      },
    ],
  }) satisfies z.ZodType<CoverageReport>;
