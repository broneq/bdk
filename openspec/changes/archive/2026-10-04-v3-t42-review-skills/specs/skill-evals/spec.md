## ADDED Requirements

### Requirement: Review models measurement

The `review-models` suite SHALL measure the model of the part reviewer (T42-M). Each run types `/bdk:cr` in a fresh copy of a seeded, executed Change: plan parts whose committed code holds seeded logic errors and test gaps, and one integration error across two parts. An answer key in the suite names each seeded defect with its file, its line range and its class (`logic`, `test-gap`, `integration`).

The cells SHALL differ only in the `model` of the `reviewer` adapter in the plugin copy: `sonnet`, `sonnet-prime` (A/A) and `opus`. The `integration-reviewer` stays on its adapter in every cell. Per run the suite SHALL record:

- recall per defect class: a seeded defect counts as found when an entry of the round names its file and a line in its range and the judge matches its summary to the defect;
- false alarms: entries the coordinator did not triage `not-a-problem` and that match no seeded defect;
- cost and wall-clock time.

The report SHALL compare `sonnet` with `opus` by the difference rule against the `sonnet`/`sonnet-prime` noise floor. `--probe` SHALL behave as for every other suite, and the measured series SHALL run only after the user approved the probe's projection. Until a series decides otherwise, the `reviewer` adapter stays on `sonnet`.

#### Scenario: probe

- **WHEN** `pnpm eval review-models --probe` runs
- **THEN** one run per cell finishes, each row holds recall per class, false alarms, cost and time, and the projected cost of the full series is printed with no further run started

#### Scenario: config check without a model

- **WHEN** `pnpm eval check` runs
- **THEN** the `review-models` config and answer key validate, every seeded defect's file exists in the seed, and no model is called

### Requirement: Review stage cases

The `stages` suite SHALL hold cases for `cr` and for a run that crosses the review stage:

- `cr` happy path on an executed Change: the round's `merge` report exists and the `review` node is done;
- `cr` with a blocker: the seed holds a defect the reviewers block on, and the run ends with the blocker resolved by a review-fix commit and the `review` node done;
- `cr` refusal: the Change has an unexecuted part, and the run ends with no ticket opened and the reply naming `/bdk:execute`;
- `run --auto` from an intent: the run ends with the Change archived and `gate:review` passed by policy (T42-B1).

#### Scenario: run reaches the review gate

- **WHEN** `pnpm eval stages --skill run --probe` runs its `--auto` case on the fixture
- **THEN** the kernel state shows a `merge` report of a `review-fix` ticket, the `review` node done and the Change archived
