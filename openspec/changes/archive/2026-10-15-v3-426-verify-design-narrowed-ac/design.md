# Design

## Context

`verify-design` step 3.10 (#422) asks that each AC "is answered by a requirement of a delta or a decision of `design.md` ... as it stands", and step 4 makes an AC the deltas narrow a `Must address` item. In the #423 measurement the `opus` 2 draft answered AC-4 with a `delimiter` option and a quoting rule on "the delimiter in use"; a scenario wrote `food, drinks` without quotes under `;`, and `design.md` listed AC-3 as answered by the "Label with a comma" scenario. The verifier passed it: it matched AC-3 to a scenario that names its subject and did not read the scenario written for AC-4, where the narrowing is.

## Goals / Non-Goals

**Goals:** a design whose delta narrows an AC under one option fails verification in 3 of 3 runs.

**Non-Goals:** the same check in the plan and review blocks; changes to the designer.

## Decisions

### D1. The check lives in the verifier's skill text

Step 3.10 now spells out how to check an AC: quote its condition, find every requirement, scenario and decision that touches its subject, also those written for another AC, and test the AC under every option, mode or input the deltas bring in. The design's own list of answered AC is a claim to check. The report writes one `Checked` line per AC, so the reading leaves a trace and a skipped AC shows.

Alternative: a list the designer must fill, each AC mapped to its scenarios with the condition quoted (the issue's "To resolve in the spec"). Lost: the miss came from such a list, the `opus` 2 design named AC-3 as answered, and the verifier trusted it. A list is the author's claim; the verifier must still read every scenario against the AC, so the list adds a second artifact to keep in step without closing the gap. One block, one job: the author writes, the verifier checks (CLAUDE.md, "Building skills (v3)").

Alternative: a CLI helper that matches AC to scenarios. Lost: whether a scenario narrows an AC is a reading of meaning, not a text match, and no measurement shows a problem a helper would solve.

### D2. Generic examples in the skill text

The skill's examples name a format, a locale, a flag and a unit, not a delimiter or a comma, so the case does not pass because the skill text names its fixture.

## Risks / Trade-offs

- [A stricter reading fails sound designs] -> the rule fires only on an outcome the AC rules out or a case its condition covers and the delta drops; `verify-design-dropped-ac-user` guards the `PASS` side.
- [A longer report] -> one `Checked` line per AC; a proposal holds a handful.

## Measurement

2026-10-15, Claude Code 2.1.292, clean `HOME`, the `git` entry of "Host limits", `--ablation none --model sonnet` (the verifier on `opus`, its frontmatter), on the skill text of this Change:

| Run | Case | Score | Verdict | Cost | Machine time |
|---|---|---|---|---|---|
| 1-3 (`--runs 3 -j 3`) | `verify-design-narrowed-ac` | 1.00 each | `FAIL`, M1 names AC-3 | $1.10 | 48 s |
| 4 (`--keep-temp`) | `verify-design-dropped-ac-user` | 1.00 | `PASS`, `Must address` none | $0.34 | 47 s |
| 5 (`--keep-temp`) | `verify-design-narrowed-ac` | 1.00 | `FAIL`, M1 names AC-3 | $0.35 | 45 s |

The kept report of run 5 names the scenario "Comma label under a semicolon delimiter" and D3, quotes AC-3 from the proposal and the source, and writes one `Checked` line per AC with the requirements and scenarios read and the delimiters under which each holds ("AC-3 ... holds under `,` only"). Run 5 was kept to read the item's reason, since the graders only show that AC-3 is named. No run on the skill text before this Change: the #423 measurement is the baseline (the miss in 1 of 3 verifier runs on a narrowing draft). Total: $1.79 of the $5 Budget, 140 s of runs.

## Open Questions

None.
