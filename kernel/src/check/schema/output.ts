// Generates `schema/cli/output/check-run.json` (kernel/scripts/export-schemas.ts; #166).
import * as z from "zod";

import type { CheckRunReport } from "../domain/report.ts";

const path = z.string().meta({ description: "Path relative to the project root." });
const verdict = z.enum(["pass", "fail", "not-run"]);

const check = z.strictObject({
  kind: z.string().min(1).meta({ description: "The step kind: tests-scoped or lint." }),
  tool: z.string().min(1).meta({ description: "The tools.test or tools.lint entry id." }),
  command: z.string().min(1).meta({ description: "The command as run, {files} filled." }),
  exit: z.int().optional().meta({ description: "Its exit code; absent when killed or skipped." }),
  timeout: z.int().min(1).optional().meta({
    description: "The seconds after which the kernel killed it with its process group.",
  }),
  skipped: z.string().optional().meta({ description: "The entry's when, for --skip." }),
  verdict,
  file: path.meta({ description: "Its output, under .bdk/.machine/checks/<ticket>/." }),
  tail: z.array(z.string()).optional().meta({
    description: "The last 20 lines of a failing check's output.",
  }),
});

export const checkRunOutput = z
  .strictObject({
    target: z
      .string()
      .regex(/^(?:\d{2}(?:-[1-9]\d*)?|\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*)$/)
      .meta({ description: "A task, a part, or the Change id under a review-fix ticket." }),
    ticket: z.string().regex(/^A-[0-9a-z]{8}$/),
    verdict: verdict.meta({
      description: "fail when any kind failed, not-run when none passed or failed, else pass.",
    }),
    checks: z.array(check),
    evidence: z
      .record(z.string(), z.string().regex(/^E-[0-9a-z]{8}$/))
      .meta({ description: "The kernel manifest id per kind." }),
    diff: z.strictObject({
      declared: z.array(path),
      touched: z.array(path),
      undeclared: z.array(path).meta({
        description: "Touched paths the target does not declare; attempt close records them.",
      }),
    }),
    commit: z
      .strictObject({
        paths: z.array(path).min(1),
        command: z.string().min(1).meta({
          description:
            "The git command that commits the paths with the BDK trailers; run it as printed.",
        }),
      })
      .optional()
      .meta({ description: "Absent on a fail verdict or when no declared path changed." }),
  })
  .meta({
    title: "bdk check run --json",
    description:
      "Run the post-task checks of a task, a part or a review round's fix under its ticket, record their evidence and print the commit command.",
    examples: [
      {
        target: "02-3",
        ticket: "A-7f3k9m2q",
        verdict: "pass",
        checks: [
          {
            kind: "tests-scoped",
            tool: "vitest",
            command: "pnpm vitest related --run src/auth/login.ts src/auth/login.test.ts",
            exit: 0,
            verdict: "pass",
            file: ".bdk/.machine/checks/A-7f3k9m2q/02-3-tests-scoped-vitest.txt",
          },
          {
            kind: "lint",
            tool: "eslint",
            command: "pnpm eslint src/auth/login.ts src/auth/login.test.ts",
            exit: 0,
            verdict: "pass",
            file: ".bdk/.machine/checks/A-7f3k9m2q/02-3-lint-eslint.txt",
          },
        ],
        evidence: { "tests-scoped": "E-b6n9t2kq", lint: "E-c7p3v4mr" },
        diff: {
          declared: ["src/auth/login.test.ts", "src/auth/login.ts"],
          touched: ["src/auth/login.test.ts", "src/auth/login.ts"],
          undeclared: [],
        },
        commit: {
          paths: ["src/auth/login.test.ts", "src/auth/login.ts"],
          command:
            "git add -- src/auth/login.test.ts src/auth/login.ts && git commit -m 'Accept a magic link token' --trailer 'BDK-Change: 2026-09-25-passwordless-login' --trailer 'BDK-Part: 02' --trailer 'BDK-Task: 02-3' -- src/auth/login.test.ts src/auth/login.ts",
        },
      },
    ],
  }) satisfies z.ZodType<CheckRunReport>;
