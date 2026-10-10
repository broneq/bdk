# Design

## Context

See proposal.md - Why. What exists:

- `implement-part` step 4 (#346): a scenario listed with ` (behaviour present)` gets a test that must pass at the first run; an unmarked scenario whose test passes is a `plan-defect` stop. `plan-fixes` step 2 traces the WHEN of a scenario through the code to decide "present" and writes the suffix (`plan-fixes` step 4).
- `plan-draft` steps 2-4 list and assign scenarios, with no rule for the suffix. The `bdk:planner` agent has `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Skill`; the skill's `allowed-tools` grant `Bash` only for `bdk`.
- `verify-plan` step 3 checks ownership of scenarios, names, dependencies; nothing about markers.
- #260 "Measurement": 17 scenarios of four MODIFIED requirements, 7 present, all unmarked; the verifier passed it.

## Goals / Non-Goals

**Goals:** the planner marks exactly the present scenarios; the verifier fails a wrong marker; both measured on a Change that MODIFIES existing requirements.

**Non-Goals:** changing `implement-part` (its stop is right: the part and the code must agree); a CLI helper.

## Decisions

### D1. Present is decided by reading the code, not by running tests

The planner traces the scenario's WHEN through the code to the output, as `plan-fixes` does (#346). Alternative: run the existing tests - lost: the scenarios of a delta mostly have no test yet (the implementer writes it), so a green suite says nothing about them; the planner's tools do not include running the project's tests (`allowed-tools` grants `Bash` for `bdk` only); a run would also make a plan depend on the state of the machine. A scenario that the code satisfies only in part, or that needs something an earlier part of the plan builds, is not marked: the suffix claims a test that passes before any task runs, and a wrong claim stops the part the same way a missing one does. The existing tests are read as evidence only (a test beside the code that already asserts the THEN).

### D2. A part of present scenarios only: allowed when nothing else owns them

Scenarios go to the part that owns the code or test file they concern (step 3, rule 6), so the present scenarios of a requirement join the part that adds that requirement's new scenarios and shares its test file: no part is written for them. A Change whose scenarios are all present (or whose present ones concern a file no other part touches) gets a small test-only part; such a part is valid, as the fix parts of `plan-fixes` are. Alternative: always merge into another part - lost: it forces an edge or a shared file between parts that share nothing and lengthens the wave chain, against the goal of few waves.

### D3. Marker format

Exactly as `plan-fixes` writes it: the line `` - `<capability>` / Requirement: <name> / Scenario: <name> (behaviour present) `` and `Verified by:` ending `; it passes at its first run, the behaviour is present`, with the test's exact input and expected result. `bdk plan check` and the implementer already read it.

### D4. verify-plan: markers go under Must address

A wrong marker stops execute (unmarked present: `plan-defect` by a strict implementer; marked missing: `plan-defect` always), so it is a `Must address` item, one new numbered item beside the scenario ownership one. The verifier traces the WHEN of each scenario; the cost is one trace per scenario, bounded by the code each part already names.

### D5. Evals: fixture `tally-modified.sh`

The Change `count-entries` on `tally`: main spec requirements `Total` and `Usage`; the delta MODIFIES both: `Total` keeps `Total of added amounts` and `Empty ledger` (the code satisfies both) and adds `Count flag`; `Usage` keeps `Unknown command` (satisfied) and changes `Help` (the usage line must name `tally total --count`, not satisfied). Five scenarios, three present. The #260 Change has 17; this one has the same shape at the size of a block case. `plan-draft-present-scenarios` grades with a regex per scenario on the parts; `verify-plan-present-scenarios` starts from a plan with `Empty ledger` unmarked and `Count flag` marked and grades one `Must address` item each. A with/without pair measures whether the skill text changes the outcome (ADR-0003).

## Risks / Trade-offs

- [The planner marks a scenario as present on a shallow trace] -> the marker line needs the test's exact input and output, which forces the trace; `verify-plan` traces again in a fresh context.
- [The verifier over-flags] -> the item needs code evidence; a scenario with the suffix that the code satisfies passes.

## Results

2026-10-10, clean `HOME`, `--trust-plugin --allow-tools Write Edit "Bash(*/bin/bdk *)"`, 3 runs per arm:

| Case | Before the skill text (with) | With | Without | Cost |
|---|---|---|---|---|
| `plan-draft-present-scenarios` | 0.50 (1 run) | 1.00 | 0.43 | $2.87 |
| `verify-plan-present-scenarios` | 0.83 (1 run) | 1.00 | 0.00 | $1.95 |

Before the text the planner marked nothing and the verifier failed the plan for `Count flag` only, never for the unmarked `Empty ledger`: the #260 defect reproduced. The first fixture worded `Unknown command` as "prints the usage line" while the Change changes that line; the planner then left it unmarked in 3 of 3 runs (0.86-0.90), a fair reading, so the fixture words it as a line starting with `usage:`.

Not measured here: the #260 queue itself (17 scenarios, unattended execute). The block cases cover its cause; re-running the queue is a measurement for a larger fixture and is filed as a follow-up.
