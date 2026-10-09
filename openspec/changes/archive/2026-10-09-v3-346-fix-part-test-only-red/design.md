## Context

A fix part is written by `plan-fixes` (spec `bdk-auto-review`, "Fix parts") in the plan part format and built by the execute lead through `implement-part` and `conform-part` (spec `bdk-execute-blocks`). `implement-part` writes a test per acceptance scenario and must see each fail before any code ("Acceptance tests first"); its report line ends exactly `; red seen; green seen` ("Implementer report", tightened by #262 so a note can no longer hide a red that was not seen). A blocker of `Kind: other` is retried by the lead within `policy.budgets.part-attempts`; `plan-defect` and `environment` are not.

In the observed run (#346), round 1 of `fix-total-crash` raised "the main spec scenario Empty ledger has no test", auto triage decided `fix`, `plan-fixes` wrote fix part 02, and `implement-part` reported `Kind: other` because the new test passed. The lead retried once, got the same answer and blocked the stage. `bdk plan check` does not parse `## Acceptance scenarios` or `Verified by:` (`plugins/bdk/src/plan/domain/check.ts`), so a marker in those sections needs no CLI change.

## Goals / Non-Goals

**Goals:** a fix part that only adds a test for present behaviour ends `Status: done` and committed, and its report says the test passed at its first run because the behaviour is present; test-first stays strict for every other acceptance test.

**Non-Goals:** the marker in `plan-draft` parts (a planned Change adds behaviour), a change to `diagnose-bug` (it already plans no task that only pins working behaviour), a change to the triage levels of such findings.

## Decisions

### D1. `plan-fixes` decides; `implement-part` enforces

`plan-fixes` traces every finding to its cause in the code before it writes a task (step 2). For a finding that asks for a test, that trace already answers whether the code does the scenario's THEN. So `plan-fixes` decides and writes it into the part; `implement-part` holds the part to it.

Alternatives:
- *`implement-part` decides when the red run passes*: the implementer would judge, after the fact, that a test that does not fail is fine. That is the self-reported note #262 removed: a test that asserts nothing, or the wrong thing, passes too, and nothing would tell the two apart. Rejected.
- *Level or plan such findings differently* (triage defers them, or `plan-fixes` lists them as not plannable): a missing test for a spec scenario is a real gap the user asked review to close; dropping it hides it. Rejected.

### D2. The marker: ` (behaviour present)` on the acceptance scenario line

The scenario stays under `## Acceptance scenarios` (the implementer encodes its WHEN and THEN like any other), with the suffix ` (behaviour present)`: `- tally / Requirement: Total / Scenario: Empty ledger (behaviour present)`. The task's `Verified by:` names the scenario and says the new test passes at its first run. A task-level field was considered and lost: the red run is per acceptance scenario, so the scenario line is where the implementer looks. No frontmatter key: `bdk plan check` would have to learn it, and the part schema is shared with `plan-draft` (CLAUDE.md: add CLI only for a shown problem).

### D3. Report line `; green at first run (behaviour present); green seen`

The line keeps its fixed tail form so graders and readers match it exactly: `; red seen; green seen` for every unmarked scenario, `; green at first run (behaviour present); green seen` for a marked one, nothing between or after. `green seen` stays: the part check after the tasks still runs the test.

### D4. Disagreement between the part and the code is a plan defect

- An unmarked scenario's test passes in the red run, while it encodes the WHEN and THEN: the part claims behaviour is missing that the code has. `Kind: plan-defect`, proposal: mark the scenario ` (behaviour present)`.
- A marked scenario's test fails because the behaviour is missing (not a broken test): the part claims behaviour the code lacks, and no task fixes it. `Kind: plan-defect`, proposal: drop the marker and add a task that fixes the code.

Before, the first case was `Kind: other`, which the lead retried for nothing (#346). A retry cannot change the part; `plan-defect` goes straight to the part's author (`plan-fixes` through `/bdk:auto-review`, per `execute-waves` step 1).

### D5. Eval cases on a new fixture `tally-total-untested.sh`

The fixture extends `tally-change.sh` (the Change `add-total`, whose code already does "Empty ledger" while its only total test covers "Total of added amounts") with the BDK schema, plan part 01, that test and review round 1 judged and triaged: one `should-fix` finding "scenario Empty ledger has no test" decided `fix`. It mirrors the observed run on a smaller project.

- `plan-fixes-present-behaviour` (block): fix part 02 lists "Empty ledger" with ` (behaviour present)`.
- `implement-part-present-behaviour` (block): from that part written, `Status: done`, the report line ends `; green at first run (behaviour present); green seen`, the red run passed.
- `auto-review-present-behaviour` (orchestrator, the acceptance signal): `/bdk:auto-review add-total` with a budget of two rounds plans the fix, builds and commits part 02 (`fixes/state.json` `done`, `fixes/result.md` `Status: done`), and the part report has the green-at-first-run line.

`implement-part-csv` keeps guarding the strict red path for unmarked scenarios.

## Risks / Trade-offs

- `plan-fixes` may mark a scenario whose behaviour is in fact missing. Then the marked test fails red and D4 stops with a plan defect, so a wrong marker never lets a missing behaviour through.
- `plan-fixes` may forget the marker. Then the part blocks as before, but as a `plan-defect` with the fix named, without a wasted retry.
- On the rebase onto `staging/v3`, #264 had added an unrelated case named `auto-review-test-only-fix` (a test gap on `monthly-report`, graded for the E2E carry-over), so this Change's orchestrator case is named `auto-review-present-behaviour`. That #264 case is also a test of present behaviour; it was run again with this Change (see `plugins/bdk/evals/README.md`).
