## ADDED Requirements

### Requirement: B1-sized fixture

The suite SHALL ship a shared fixture of a Change the size of B1, in two states, each a script under `plugins/bdk/evals/fixtures/`:

- `household-book.sh` SHALL build a configured BDK project (`.bdk/settings.yaml` with a test and an e2e tool, `openspec/` with the BDK schema copied from the plugin, a main spec of the product, the product's code with passing tests) holding one active Change, `add-household-book`, with a proposal, spec deltas and a design, and with the design approval records under `.bdk/runs/add-household-book/design/`: the last report `verify-N.md` reading `Verdict: PASS`, and `gate.md` reading `Gate: approved` with a `Report:` line naming that report. It SHALL hold no plan part.
- `household-book-planned.sh` SHALL build the same project by running `household-book.sh` and adding the Change's plan parts and `.bdk/runs/add-household-book/plan/verify-1.md` reading `Verdict: PASS`, in one more commit.

The plan of the planned state SHALL have 7 parts, 27 tasks and 62 distinct files, SHALL pass `bdk plan check` with the default part limits, SHALL have at most 3 waves, and SHALL name every scenario of the Change's spec deltas in the acceptance scenarios of exactly one part. `plugins/bdk/evals/README.md` SHALL describe both states and how to start a run by hand at plan, at execute and at plan-to-PR.

#### Scenario: Ready to plan

- **WHEN** `household-book.sh` runs in an empty directory
- **THEN** `openspec/changes/add-household-book/` holds `proposal.md`, `design.md` and spec deltas but no `plan/`, the design gate reads `Gate: approved`, and `npm test` exits 0

#### Scenario: Planned state passes the plan check

- **WHEN** `household-book-planned.sh` runs in an empty directory and `bdk plan check openspec/changes/add-household-book/plan/parts` runs there
- **THEN** it exits 0 and reports 7 parts and 3 waves, the parts hold 27 tasks and list 62 distinct files, and every scenario of the spec deltas is named by exactly one part
