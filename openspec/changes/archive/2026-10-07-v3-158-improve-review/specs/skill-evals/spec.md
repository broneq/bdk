# Spec Delta

## MODIFIED Requirements

### Requirement: Review models measurement

The `review-models` suite SHALL measure the model of the part reviewer (T42-M). Each run types `/bdk:cr` in a fresh copy of a seeded, executed Change: plan parts whose committed code holds seeded logic errors and test gaps, and one integration error across two parts. An answer key in the suite names each seeded defect with its file, its line range and its class (`logic`, `test-gap`, `integration`).

The cells SHALL differ only in the `model` of the `reviewer` adapter in the plugin copy: `sonnet`, `sonnet-prime` (A/A) and `opus`. The `integration-reviewer` stays on its adapter in every cell. Per run the suite SHALL record:

- recall per defect class: a seeded defect counts as found when an entry of the round names its file and a line in its range and the eval's matcher model matches its summary to the defect (the suite's matcher, not the `judge` role of the round);
- false alarms: entries the round did not triage `not-a-problem` and that match no seeded defect, and the raw false alarms: every `finding` and `blocker` that matches no seeded defect, whatever its level, so the triage's filtering shows as the difference;
- recall after triage per defect class: a seeded defect counts only when an entry that finds it was not triaged `not-a-problem`, and the count of seeded defects whose only finding entries were triaged `not-a-problem`;
- for the round (#158): the integration reviewer's wall time and tokens, the reviewer groups that hold a binary file, the reviewers denied by `guard/reader-write`, the group reports that end with `## Seams`, whether the integration report holds `## Intent` before `## Areas`, the findings whose body has a `Failure scenario:` paragraph, the judge's wall time and tokens, whether the judge ended before the gate runner, the judge's `guard/reader-write` and `guard/judge-scope` denials, and the share of the judge package's entries that its `## Verdicts` names and that hold the level it names;
- cost and wall-clock time.

The report SHALL compare `sonnet` with `opus` by the difference rule against the `sonnet`/`sonnet-prime` noise floor. `--probe` SHALL behave as for every other suite, and the measured series SHALL run only after the user approved the probe's projection. Until a series decides otherwise, the `reviewer` adapter stays on `sonnet`.

#### Scenario: probe

- **WHEN** `pnpm eval review-models --probe` runs
- **THEN** one run per cell finishes, each row holds recall per class, false alarms, cost and time, and the projected cost of the full series is printed with no further run started

#### Scenario: config check without a model

- **WHEN** `pnpm eval check` runs
- **THEN** the `review-models` config and answer key validate, every seeded defect's file exists in the seed, and no model is called

#### Scenario: triage that drops a seeded defect is visible

- **WHEN** a run's only entry that finds the seeded defect `null-body` was triaged `not-a-problem`
- **THEN** the row counts `null-body` as found, not as found after triage, and counts it among the defects dismissed by triage
