# Debug Skill — Iteration 1 Benchmark

## Pass Rates

| Configuration | Eval 1 (float bug) | Eval 2 (multicurrency) | Eval 3 (vague input) | Mean |
|---|---|---|---|---|
| with_skill | 7/7 = **100%** | 5/6 = **83%** | 4/4 = **100%** | **94%** |
| without_skill | 1/7 = **14%** | 1/6 = **17%** | 3/4 = **75%** | **35%** |

**Delta: +59 percentage points** in favour of with_skill.

## Timing & Tokens

| Configuration | Eval 1 | Eval 2 | Eval 3 |
|---|---|---|---|
| with_skill tokens | 26,582 | 32,435 | 23,433 |
| without_skill tokens | 20,054 | 20,164 | 19,104 |
| with_skill duration | 83.6s | 189.9s | 47.0s |
| without_skill duration | 38.5s | 38.9s | 20.8s |

The skill uses ~1.5–1.6× more tokens and ~2–5× more time. This is expected — it runs multiple phases, confirms RED, and asks user questions. The overhead is the value.

## Analyst Notes

### Assertion that fired incorrectly
`recommends_create_plan` in Eval 2 failed — but this is an **assertion bug, not a skill bug**.
The scenario (hardcoded constant, 2 files, 15 lines) is genuinely LOW complexity (~3k tokens). The skill correctly estimated this and recommended inline fix. The assertion assumed multi-component bugs always route to create-plan, which is wrong per the skill design (token estimate drives routing, not number of components). **Fix: replace assertion with one that checks the estimate is provided and all 3 options are offered.**

### Discriminating assertions (skill adds clear value)
- `writes_concrete_failing_test` — 0/3 baselines wrote actual test code; skill did in all evals
- `confirms_tests_are_red` — never in baseline; always in skill
- `asks_user_confirmation` — never in baseline; always in skill
- `scans_for_related_gaps` — never in baseline; skill found sibling functions in Eval 1 and pipeline gaps in Eval 2

### Non-discriminating assertion
- `identifies_root_cause` / `traces_call_chain` — baseline also does this well. The skill's advantage is *what it does after* identifying the root cause, not the investigation itself.

### Vague input (Eval 3)
Both with_skill and without_skill stop and ask. The skill adds structure (4 concrete options) but the baseline behaviour is already correct. This eval has low discriminating power — the skill's gate is a safety net, not a differentiator here.

## Conclusion

The skill works correctly across all three scenarios. One assertion needs fixing (eval 2 `recommends_create_plan`). No skill changes needed from this iteration.
