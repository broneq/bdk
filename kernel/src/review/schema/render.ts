// Generates `schema/cli/output/review-render.json` (kernel/scripts/export-schemas.ts),
// and validates the `--pr` input of `bdk review render`.
import * as z from "zod";

import type { PrInput } from "../domain/pr.ts";
import type { RenderResult } from "../domain/render.ts";

const entryId = z.string().regex(/^L-[0-9a-z]{8}$/);
const findingId = z.string().regex(/^\d+-\d+$/);

export const reviewRenderOutput = z
  .strictObject({
    change: z.string().min(1).nullable().meta({
      description: "The rendered Change; null for the pull request page.",
    }),
    format: z.enum(["html", "md"]),
    path: z.string().min(1).meta({
      description:
        "The written file: relative to the project root when inside it, absolute otherwise.",
    }),
    range: z.string().min(1).nullable().meta({
      description: "`<base>..<head>` of the whole Change; null for the pull request page.",
    }),
    undecided: z.array(z.union([entryId, findingId])).meta({
      description:
        "The Decisions entries without a disposition, in page order; every finding id on the pull request page.",
    }),
    decided: z.array(entryId).meta({
      description: "The Decisions entries with a disposition, in page order.",
    }),
    tracker: z.enum(["github", "instruction"]).nullable().meta({
      description: "The `tracker` kind; null while unset, and then no choice offers `track`.",
    }),
  })
  .meta({
    title: "bdk review render --json",
    description:
      "Render the human review report of the active Change, or the decision page of a pull request review.",
    examples: [
      {
        change: "2026-09-25-passwordless-login",
        format: "html",
        path: ".bdk/.machine/review/2026-09-25-passwordless-login.html",
        range: "4f1c2d9a7b3e5f60718293a4b5c6d7e8f9a0b1c2..9a8b7c6d5e4f30211203f4e5d6c7b8a9f0e1d2c3",
        undecided: ["L-q2w3e4r5"],
        decided: ["L-m3n4b5v6"],
        tracker: "github",
      },
    ],
  }) satisfies z.ZodType<RenderResult>;

const text = z.string().min(1);

/** The `--pr` input: the parsed `pr-review-result` blocks of `pr-review`. */
export const prInputSchema = z.strictObject({
  prs: z.array(
    z.strictObject({
      number: z.int().min(1),
      url: text,
      title: text,
      verdict: text.optional(),
      findings: z.array(
        z.strictObject({
          path: text,
          line: z.int().min(1),
          severity: text,
          category: text,
          blocking: z.boolean(),
          problem: text,
          why: text.optional(),
          fix: text,
        }),
      ),
    }),
  ),
}) satisfies z.ZodType<PrInput>;

/** The first wrong field of a zod issue list, as `prs[0].number`. */
export function firstField(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return "the input";
  const path = issue.path
    .map((key, at) =>
      typeof key === "number" ? `[${String(key)}]` : `${at === 0 ? "" : "."}${String(key)}`,
    )
    .join("");
  return `${path === "" ? "the input" : path}: ${issue.message}`;
}
