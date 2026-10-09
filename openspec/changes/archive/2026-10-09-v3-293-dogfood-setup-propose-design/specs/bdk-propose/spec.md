## MODIFIED Requirements

### Requirement: Change opened with the BDK schema

The skill SHALL open the Change with `openspec new change <name> --schema bdk`. When the arguments hold `--name <name>`, the Change SHALL take that name; it SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`), otherwise the skill SHALL stop and create nothing. Without `--name`, the skill SHALL read the project's `openspec/config.yaml` before it names the Change, and when a `rules.proposal` entry says how a Change is named, the name SHALL follow that rule. Without such a rule, the name SHALL be kebab-case and describe the change in two to five words, and a Change from an issue SHALL be named `<issue-number>-<slug>`. When the name is already taken by a Change that has a `proposal.md`, the skill SHALL NOT overwrite it: it SHALL report that Change and its proposal path and stop. When the taken Change has no `proposal.md`, the skill SHALL write the proposal into it.

#### Scenario: Change from an issue

- **WHEN** `/bdk:propose #42` runs for an issue titled "Export the ledger as CSV" in a project whose `openspec/config.yaml` has no naming rule
- **THEN** a directory `openspec/changes/42-<slug>/` exists whose `.openspec.yaml` names `schema: bdk`

#### Scenario: Project naming rule

- **WHEN** `/bdk:propose #42` runs in a project whose `openspec/config.yaml` `rules.proposal` says "A change is named `v3-<N>-<slug>`, where N is the tracking issue number"
- **THEN** the Change is `openspec/changes/v3-42-<slug>/`

#### Scenario: Name given

- **WHEN** `/bdk:propose #42 --name 42-csv-export` runs
- **THEN** the Change is `openspec/changes/42-csv-export/`, whatever the issue's title and the project's naming rule

#### Scenario: Existing proposal kept

- **WHEN** `/bdk:propose` would open a Change whose directory already holds a `proposal.md`
- **THEN** the file is unchanged and the reply names the existing Change and its proposal

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill, each built on a project configured for BDK with a main spec: `propose-from-issue` (an issue becomes a proposal, read through the offline `gh` stand-in), `propose-from-intent` (an intent becomes a proposal), `propose-naming-rule` (an issue in a project whose `rules.proposal` names Changes `v3-<N>-<slug>`) and `propose-not-configured` (an unconfigured project stops). Each SHALL grade the result and the steps and show that the skill fired.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the four `propose-*` cases load with no error at zero cost and their scaffolds exit 0
