// Generates `schema/cli/output/rules-show.json` (kernel/scripts/export-schemas.ts).
import * as z from "zod";

import { ROLES, RULE_ID } from "../../shared/vocabulary/index.ts";
import type { RulesShow } from "../domain/report.ts";

const ruleId = z.string().regex(RULE_ID);
const kind = z.enum(["house", "knowledge"]);
const severity = z.enum(["critical", "high", "medium", "low"]);
const globs = z.array(z.string().min(1));

export const ticketRulesOutput = z
  .strictObject({
    ticket: z.string().regex(/^A-[0-9a-z]{8}$/),
    group: z.string().min(1).optional().meta({
      description: "The review group of a `<ticket>@<group>` reference.",
    }),
    role: z.enum(ROLES),
    target: z.string().min(1),
    rules: z
      .array(
        z.strictObject({
          id: ruleId,
          kind,
          severity,
          applies: globs.optional(),
          matchedBy: z.string().nullable().meta({
            description:
              "The glob that matched a file of the target; null for a rule without applies or a target without files.",
          }),
          text: z.string(),
        }),
      )
      .meta({ description: "The rules the active package records, in its order." }),
    rulesRead: z.iso.datetime({ precision: 3 }).optional().meta({
      description:
        "The `rules-read` stamp of the attempt record: the time of the implementer's first call for the ticket; absent until then.",
    }),
  })
  .meta({ title: "rules of a ticket" });

export const oneRuleOutput = z
  .strictObject({
    id: ruleId,
    scope: z.enum(["bundle", "project"]),
    file: z.string().min(1).meta({
      description: "Relative to the plugin root for the bundle, to the project root otherwise.",
    }),
    kind,
    severity,
    applies: globs.optional(),
    roles: z.array(z.enum(ROLES)).optional(),
    origin: z.string().min(1),
    evidence: z.array(z.string()).optional(),
    since: z.iso.date(),
    source: z.string().optional(),
    verified: z.iso.date().optional(),
    removed: z.string().optional().meta({ description: "The tombstone's reason." }),
    disabled: z.boolean().meta({ description: "True when `rules.disabled` names the rule." }),
    text: z.string(),
  })
  .meta({ title: "one rule" });

export const rulesShowOutput = z.union([ticketRulesOutput, oneRuleOutput]).meta({
  title: "bdk rules show --json",
  description: "Print one rule by id, or the rules of a ticket.",
  examples: [
    {
      ticket: "A-7f3k9m2q",
      role: "implementer",
      target: "02-3",
      rules: [
        {
          id: "BDK-CQ-1",
          kind: "house",
          severity: "medium",
          matchedBy: null,
          text: "Descriptive identifiers; no abbreviations unless idiomatic for the language.",
        },
        {
          id: "BDK-REACT-4",
          kind: "house",
          severity: "medium",
          applies: ["**/*.tsx"],
          matchedBy: "**/*.tsx",
          text: "Forms go through Actions ...",
        },
      ],
      rulesRead: "2026-09-25T10:00:41.305Z",
    },
    {
      id: "API-2",
      scope: "project",
      file: ".bdk/rules/API-2.md",
      kind: "house",
      severity: "high",
      applies: ["src/api/**"],
      origin: "2026-09-25-passwordless-login/L-m2x9v7qa",
      evidence: ["2026-09-25-passwordless-login/L-m2x9v7qa"],
      since: "2026-09-27",
      disabled: false,
      text: "Every handler validates its input with the shared schema before it reads the body.",
    },
  ],
}) satisfies z.ZodType<RulesShow>;
