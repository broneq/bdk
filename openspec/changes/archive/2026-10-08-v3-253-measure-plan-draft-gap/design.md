# Design

## Context

- `plan-draft` step 2 (`plugins/bdk/skills/plan-draft/SKILL.md`): "When the specs and the design leave open a choice that changes what the product does, and the code does not settle it, do not decide it: name it in the reply as a gap of the design, write no part for it, and stop if nothing can be planned without it." Step 7 lists "gaps of the design you did not decide" in the reply.
- #242 (`v3-242-measure-plan-draft`, "Measurement", "Decision") kept the block for the part limits on `plan-draft-household-book`; the gap rule was not exercised, as the fixture's design (`fixtures/household-book/change/design.md`) ends with "Open Questions: None" and passed `verify-design` and the gate.
- In that design, recurring entries take a day of 1 to 28 (spec delta `ledger-recurring`, "Recurring entries", scenario "Day out of range" with `--day 31`; design D7: "The days 29-31 are refused, so every month has the due day" with the lost alternative "clamp to the month's last day"). The "Due entries" requirement takes "the date of its day in that month", which is defined only because no month lacks a day of 1 to 28.
- Grader types of `claude plugin eval` (2.1.292): `regex` (with `match: not_contains`) on the last message, the trace or one file, `file_exists`, `tool_used`, `tool_order`, `llm` on the last message. The trace holds the final reply, so a `not_contains` pattern over the trace for a decided short-month rule would also fail a reply that names the options; no grader reads every part file.

## Goals / Non-Goals

**Goals:**

- A recorded with/without result for the gap rule on a Change of B1 size with exactly one open product choice.
- A keep, change or remove decision for the rule by a decision rule fixed before the runs are read (D5).

**Non-Goals:**

- Re-measuring the part limits or the plan's `verify-plan` quality (#242).
- A gap the code settles, or several gaps at once: one clean gap keeps the result readable.

## Decisions

### D1. The open choice: recurring days 29 to 31 in a short month

The variant accepts recurring days 1 to 31 and says nothing about a month without the day. What a recurring entry on day 31 does in September (skip the month, move to the 30th, move to 1 October) changes the entries the book gets and the money a user sees, so it is a product choice. Nothing in the code settles it: `ledger` has no recurring code and no date module yet (design D3 plans `src/dates.js` with `monthsFrom`, which knows months, not days). It touches one requirement and one part of a plan, so the rest of the Change can still be planned: the expected outcome is a full plan, a reply naming the choice, and no part deciding it.

Alternatives: a gap in the import duplicate rule or the budget sign - lost, both are fixed by several scenarios, so opening one changes many texts and the scenario count; removing a whole decision such as the book migration - lost, it blocks most of the plan, so the case would measure the "stop if nothing can be planned" branch instead of the common one.

### D2. A case scaffold on top of `household-book.sh`

`plan-draft-household-book-gap/scaffold.sh` runs `household-book.sh`, then edits in place, each edit checked so a later change of the fixture fails the scaffold instead of building a variant without the gap:

- spec delta `ledger-recurring`: "a whole number from 1 to 28" and `day must be 1 to 28` become 1 to 31; the scenario "Day out of range" uses `--day 32`.
- design D7: the two sentences on refusing days 29-31 and the lost clamp alternative are removed; the day check names `day must be 1 to 31`.
- the design approval records under `.bdk/runs/add-household-book/design/` that quote `day must be 1 to 28` or `--day 31` quote the new range, so no file in the workspace names the old rule.

The edits are folded into the fixture's last commit (`git commit --amend` with the fixture's date and identity), so the history shows an approved design and no commit that points at the gap. `plugins/bdk/tests/household-book.test.ts` builds the variant beside the shared fixture and checks the spec's scenarios (`skill-evals`, "plan-draft design-gap case on the B1-sized fixture").

Alternatives: a new shared fixture `household-book-gap.sh` - lost, one case uses it (eval README, "Shared fixtures"); copies of the two changed files in the case directory - lost, a later edit of the fixture's design would leave the copy stale without failing.

### D3. Prompt and graders

The prompt is the one of `plan-draft-household-book` ("draft its implementation plan; I will have the draft verified separately"), so the only difference between the two cases is the open choice, and it names neither the skill nor the gap. Graders:

- `gap-named` (`llm`): PASS when the final reply says that the specs and design do not settle what a recurring entry on a day 29 to 31 does in a month without that day, and leaves it to the user; FAIL when it is not mentioned or when the reply says a part uses a behaviour for such months, even when it asks the user to confirm it.
- `part-written` (`file_exists` on part 01): the rest of the Change is still planned.
- `design-before-parts` (`tool_order`, Read of the design before the first Write of a part), the step grader of a block case.
- `skill-fired` (`tool_used: Skill`, `plan-draft`).

"No part decides it" is not a grader (Context: no grader reads every part, and a trace pattern also matches a reply that names the options); it is measured on the kept workspaces (D4).

### D4. Measurement

`--model sonnet` (as #242), 3 runs per arm, `-j 3`, `--keep-temp`, grants `Write Edit "Bash(*/bin/bdk *)"`, from a clean `HOME` and a `PATH` without other plugins' `bin/` (eval README, "Host limits"). Per run:

1. **Named**: the reply names the short-month choice as open (the `gap-named` verdict, read again by hand).
2. **Decided**: a written part fixes the short-month behaviour: every part is searched for days 29-31, "last day", "clamp", "skip", "short month", "does not exist" and similar, and the part that owns `ledger-recurring` is read in full.
3. **Held** = named and not decided.
4. Parts written, `bdk plan check` exit code, time and cost from the harness result.

### D5. Decision rule, fixed before the runs are read

- **Keep** the rule when the with-arm holds in at least 2 of 3 runs and in more runs than the without-arm; the size of the difference is reported as it is.
- **Change** when the with-arm holds in at most 1 of 3 runs: the rule does not work as written. Rewrite step 2 (and step 7) with `/skill-creator` from what the failing runs did, and run the with-arm of the case again.
- **Remove** when the with-arm holds in at least 2 of 3 runs and the without-arm holds as often: the model names the gap without the rule, so the paragraph and the gap line of step 7 go (ADR-0003: a text stays only when it changes the outcome).

## Measurement

2026-10-08, Claude Code 2.1.292, `--model sonnet`, judge haiku, 3 runs per arm, clean `HOME`, `PATH` without other plugins' `bin/`; the kept workspaces read after the run, `bdk plan check` run on a copy of each.

Harness score: WITH 1.00, W/OUT 0.89, Δ +0.11; `plan-draft` fired in every with-arm run. The only grader any run failed was `gap-named`, once, without the plugin.

| Measure (D4) | `plan-draft` (3 runs) | no plugin (3 runs) |
|---|---|---|
| reply names the short-month choice | 3/3 | 3/3 |
| a part decides it | 0/3 | 3/3: skip the month (one run), clamp to the last day (two runs) |
| held (named, not decided) | 3/3 | 0/3 |
| `gap-named` verdict, first rubric | 3/3 PASS | 2/3 PASS |
| `gap-named` verdict, final rubric (re-judged on the saved replies, 3 haiku votes) | 3/3 PASS | 0/3 PASS (FAIL FAIL FAIL, FAIL FAIL FAIL, FAIL FAIL PASS) |
| what is left unplanned | `recurring run` and its 4 scenarios (one run); all of `ledger-recurring`, 6 scenarios (two runs) | nothing |
| `bdk plan check` exit 0 with the default limits | 3/3 (3, 3 and 4 waves; the reply gives the reason for the fourth) | 0/3 (part 01 over `max-tasks` and `max-files` in every run, as in #242) |
| time, cost of the run | 207-236 s, $0.73-0.87 | 172-208 s, $0.59-0.69 |

What the runs did:

- Without the plugin the model noticed the gap every time and said so, but always as a choice it had already made and written into a part ("Part 07 clamps to the month's last day and pins that with a unit test. Please confirm that"; "a recurring entry on day 31 skips months with 30 days ... since I made them up"). The plan an implementer gets then builds an unapproved product rule, and `/bdk:plan` would pass it to execute.
- With the plugin every run left the choice open in the parts, named the gap with the three options, and said which part to add once the user decides; one run also recommended an option without writing it into a part.
- Two with-arm runs held back all of `ledger-recurring`, although `recurring add` and `list` do not depend on the choice. That is wider than needed (the rule says "write no part for it"), but it loses no work: the reply names the scenarios left out, and `recurring add` shares the module and command file with `run`.
- The first `gap-named` rubric passed two no-plugin replies that reported a decided rule and asked to confirm it. The rubric now fails such a reply explicitly; re-judged on the six saved replies it agrees with the hand reading in every run by majority.

Cost of the measurement: $4.39 for the six runs (judge included), and $0.02 for re-judging the saved replies with the final rubric; $4.42 in all.

## Decision

**Keep the gap rule of `plan-draft` step 2 as it is.** By D5 the with-arm held in 3 of 3 runs and the without-arm in 0 of 3: without the rule the model sees the gap but decides it inside the plan, which is the failure the rule exists to prevent. The rule costs nothing measurable: a with-arm draft took 32 s and $0.17 more on average (226 s, $0.82 against 194 s, $0.65), within the difference #242 recorded for the block as a whole (20-80 s, $0.10-0.25).

No change to the skill text: the one deviation seen (holding back a whole capability instead of only the requirement that depends on the choice, two runs) loses no work and is named in the reply; the rule does not need to be narrower for that.

## Risks / Trade-offs

- [Three runs per arm is a small sample] -> the decision names the run counts; a difference of one run is reported as such.
- [The model may treat "the date of its day in that month" as "skip the month" and call it no choice] -> that is a decision in the sense of D4 item 2 when a part writes it; the reply's reasoning is quoted in "Measurement".
- [The `llm` judge varies] -> D4 item 1 reads every reply again by hand; the hand reading counts for D5.
- [Shared ground: `plugins/bdk/evals/README.md`, `household-book.test.ts`] -> one new paragraph and one new `describe` block, no change to the existing ones.
