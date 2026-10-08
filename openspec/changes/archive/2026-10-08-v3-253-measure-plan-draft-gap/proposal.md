# Proposal

## Why

Tracks #253.

`plan-draft` was kept on the B1-sized fixture for its part limits (`v3-242-measure-plan-draft`, design "Measurement", "Decision"), but one rule of its step 2 was never exercised: when the specs and the design leave open a choice that changes what the product does and the code does not settle it, the block names the gap in its reply and does not decide it. The fixture's design is approved and holds no such choice, so #242 could not say whether the rule changes the outcome. A plan that silently decides a product choice ships behaviour nobody approved; this task measures whether the rule prevents that and decides whether it keeps its place.

## What Changes

- New block case `plugins/bdk/evals/plan-draft-household-book-gap/`: its scaffold builds the ready-to-plan state of `household-book.sh` and then opens one product choice in the Change: recurring entries may fall on days 1 to 31, and neither the spec deltas nor the design say what happens in a month that lacks the day. The case runs `plan-draft` with and without the plugin and is graded on the reply naming that gap.
- A recorded with/without measurement of the case: the harness score, and per run whether the reply names the gap and whether any written part decides it.
- A keep, change or remove decision for the gap rule of `plan-draft` step 2, recorded in this Change's design and applied.
- `plugins/bdk/tests/household-book.test.ts`: a free check that the gap variant holds the open choice and nothing else changed.
- `plugins/bdk/evals/README.md`: how to run the case and the recorded result.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: a requirement for the plan-draft design-gap case on the B1-sized fixture.

## Out of scope

- The part limits, waves and `verify-plan` quality of `plan-draft` (#242, measured and kept).
- `/bdk:plan` (#199) and how it passes a gap on to the user: not changed unless the decision moves work there.
- A gap stop in `design-draft` or `verify-design`: other blocks, not named by #253.

## Impact

- New: `plugins/bdk/evals/plan-draft-household-book-gap/`.
- Changed: `plugins/bdk/tests/household-book.test.ts`, `plugins/bdk/evals/README.md`; `plugins/bdk/skills/plan-draft/SKILL.md` only if the decision is "change" or "remove".
- The shared fixture `household-book.sh` and its data stay as they are; the variant is built by the case's own scaffold.
- No change to `package.json`, the lockfile or the CLI.
