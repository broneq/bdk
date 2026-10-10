## MODIFIED Requirements

### Requirement: Fix parts

`plan-fixes <round dir>` SHALL read the findings of the round whose latest decision is `fix` and write fix parts `<round dir>/fixes/parts/NN.md` in the plan part format (`id`, `depends-on: []`, `isolation`, `files`; goal, acceptance scenarios, tasks with `File`, `Interface` and `Verified by`), one task per finding, each task naming its finding id. Ids SHALL continue after the highest part id of the plan and of every earlier round's fix parts. Findings on the same file SHALL be in the same part; parts SHALL keep to `plan.part.max-tasks` and `plan.part.max-files`; one part SHALL be `shared`, several parts SHALL have disjoint files and be `worktree`. A finding that breaks a spec scenario SHALL list that scenario as an acceptance scenario. A finding that asks for a test of a spec scenario whose behaviour the code already has (traced in the code to the scenario's THEN) SHALL list that scenario as an acceptance scenario with the suffix ` (behaviour present)`, and its task's `Verified by:` SHALL say that the new test passes at its first run; a finding asking for such a test of behaviour the code does not have SHALL list the scenario without the suffix. A finding whose fix adds or corrects spec-delta text so that the delta describes behaviour the proposal or the design already settles, and neither contradicts, SHALL be planned as a task on that delta file. A task that adds a requirement SHALL name at least one `#### Scenario:` for it, with the WHEN and the THEN the code gives, since OpenSpec refuses a requirement without one; the part SHALL list no acceptance scenario for the text the task writes. Its `Verified by:` SHALL name `openspec validate <change> --strict` and the next round's spec conformance. The block SHALL check the parts with `bdk plan check <round dir>/fixes/parts` and fix what it reports. It SHALL write `<round dir>/fixes/index.md` naming each `fix` finding's part, and under `## Not planned` each finding it cannot plan as a fix (its fix needs a product decision: the behaviour it would document or restore contradicts another scenario, the proposal or the design, or neither settles it; or its cause cannot be found) with the reason. It SHALL change no project file.

#### Scenario: Two findings on one file

- **WHEN** round 1 of `monthly-report` (plan parts `01` and `02`) decided `fix` for the parse blocker and the `amt` rename, both in `src/parse.js`, and `defer` and `accept` for the others
- **THEN** `round-1/fixes/parts/03.md` exists with `id: "03"`, `isolation: shared`, `src/parse.js` in `files`, a task per fixed finding naming its id, no task for the deferred or accepted findings, and `fixes/index.md` names part `03` for both

#### Scenario: Missing test of present behaviour

- **WHEN** round 1 of `add-total` (plan part `01`) decided `fix` for the finding that scenario `Empty ledger` has no test, and `tally total` already prints `Total: 0.00` for an empty ledger
- **THEN** `round-1/fixes/parts/02.md` lists `tally` / `Requirement: Total` / `Scenario: Empty ledger (behaviour present)` under `## Acceptance scenarios`, its task names the finding id and a test file, and no task changes `bin/tally.js`

#### Scenario: Error message missing from the delta

- **WHEN** round 1 of `add-total` decided `fix` for a `spec-conformance` finding on `openspec/changes/add-total/specs/tally/spec.md` saying no delta lists the error `tally: not an amount: <text>` that the proposal asks for
- **THEN** a fix part lists `openspec/changes/add-total/specs/tally/spec.md` in `files` with a task naming the finding, and `fixes/index.md` holds `- None.` under `## Not planned`

#### Scenario: Requirement added by a spec-text fix

- **WHEN** round 1 of `add-total` decided `fix` for a `spec-conformance` finding that no requirement of the delta or of the main spec `tally` describes the error `tally: not an amount: <text>`
- **THEN** the task for that finding asks to add a requirement with at least one `#### Scenario:` whose WHEN runs `tally add` with a value that is not a number and whose THEN names `tally: not an amount: <text>`, and its `Verified by:` names `openspec validate add-total --strict`
