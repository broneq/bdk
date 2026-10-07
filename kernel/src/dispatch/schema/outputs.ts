// Generates `schema/cli/output/dispatch-{build,show}.json` (`kernel-cli/dispatch`).
import * as z from "zod";

import { ROLES } from "../../shared/vocabulary/index.ts";
import type { BuildReport, ShowReport } from "../domain/report.ts";

const CHANGE_DIR = ".bdk/changes/2026-09-25-passwordless-login";
const id = (prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}-[0-9a-z]{8}$`))
    .meta({ description: "Opaque merge-safe id (`kernel-state`, Identifiers)." });

export const dispatchBuildOutput = z
  .strictObject({
    path: z.string().min(1).meta({ description: "Path relative to the project root." }),
    bytes: z.int().min(1).max(163_840).meta({
      description:
        "The package size; above 163 840 bytes the build refuses (policy/package-too-large).",
    }),
    ticket: id("A"),
    target: z.string().min(1).meta({
      description: "The ticket's target: a task id, a part id, the Change id or an artifact id.",
    }),
    role: z.enum(ROLES),
    adapter: z.enum([
      "worker",
      "reader",
      "integrator",
      "judge",
      "reviewer",
      "runner",
      "scout",
      "lead",
    ]),
    scope: z.enum(["full", "high+", "blockers"]),
    model: z.string().min(1).optional().meta({
      description:
        "The model to start the agent on: the escalation ticket's model, for every role but runner and scout. `hooks pre-tool` denies an Agent call with another model.",
    }),
    kernelVersion: z.string().min(1),
    templateHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    report: z.string().min(1).meta({
      description:
        "Path relative to the project root where `bdk log ingest --ticket` stores the report.",
    }),
    group: z.string().min(1).optional().meta({
      description: "The review group of a `--group` package; its reference is `<ticket>@<group>`.",
    }),
    files: z.array(z.string().min(1)).optional().meta({
      description: "The group's files from `--file`; present exactly when `group` is.",
    }),
    entries: z.strictObject({
      full: z.array(id("L")).meta({
        description: "Accepted decisions and unresolved blockers of the target, embedded in full.",
      }),
      counted: z.record(z.string(), z.int().min(1)).meta({
        description:
          "Per-type counts of the other entries of the target, listed by `bdk log list --for <target>`.",
      }),
    }),
  })
  .meta({
    title: "bdk dispatch build --json",
    description: "Build the dispatch package file for a target, role and ticket.",
    examples: [
      {
        path: `${CHANGE_DIR}/dispatch/02-3-implementer-A-7f3k9m2q.md`,
        bytes: 9814,
        ticket: "A-7f3k9m2q",
        target: "02-3",
        role: "implementer",
        adapter: "worker",
        scope: "high+",
        kernelVersion: "3.0.0",
        templateHash: `sha256:${"2".repeat(64)}`,
        report: `${CHANGE_DIR}/reports/02-3-implementer-A-7f3k9m2q.md`,
        entries: { full: ["L-a2s5d7k1"], counted: { finding: 2, observation: 1 } },
      },
    ],
  }) satisfies z.ZodType<BuildReport>;

export const dispatchShowOutput = z
  .strictObject({
    path: z.string().min(1).meta({ description: "Path relative to the project root." }),
    content: z.string().meta({ description: "The package file, byte for byte." }),
    frontmatter: z
      .record(z.string(), z.unknown())
      .meta({ description: "The parsed frontmatter (`kernel-state`, Dispatch package)." }),
  })
  .meta({
    title: "bdk dispatch show --json",
    description: "Print a dispatch package by path or ticket.",
    examples: [
      {
        path: `${CHANGE_DIR}/dispatch/02-3-implementer-A-7f3k9m2q.md`,
        content: "---\nschema: 1\nticket: A-7f3k9m2q\n...",
        frontmatter: {
          ticket: "A-7f3k9m2q",
          target: "02-3",
          role: "implementer",
          adapter: "worker",
        },
      },
    ],
  }) satisfies z.ZodType<ShowReport>;
