## ADDED Requirements

### Requirement: Setup reports the decision surface

The skill SHALL run `npx -y lavish-axi --version` once on every run, a re-run included, and its report SHALL hold one line naming the decision surface the project gets: "questions and triage use a Lavish page" when the command exits 0, and "questions and triage use AskUserQuestion; install lavish-axi for a browser review page" when it exits non-zero or cannot run. The skill SHALL NOT install Lavish and SHALL NOT write a setting or a permission rule for it.

#### Scenario: Lavish runs

- **WHEN** `/bdk:setup` runs in a project where `npx -y lavish-axi --version` exits 0
- **THEN** the report says that questions and triage use a Lavish page

#### Scenario: Lavish does not run

- **WHEN** `/bdk:setup` runs in a project where `npx -y lavish-axi --version` exits non-zero
- **THEN** the report says that questions and triage use `AskUserQuestion` and that installing `lavish-axi` gives a browser review page, and setup installs nothing

## MODIFIED Requirements

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill: `setup-web-app`, `setup-http-api`, `setup-node-cli` and `setup-library`, one per product kind of "E2E entry by product kind", each grading the written `.bdk/settings.yaml` and `openspec/config.yaml`, the installed schema, the permission rules in the reply (Claude Code refuses a write to `.claude/settings.json` in an eval run) and that the skill fired. `setup-web-app` SHALL put a `lavish-axi` stand-in that answers `--version` into the workspace and grade that the reply reports the Lavish page; `setup-library` SHALL put a stand-in that fails into the workspace and grade that the reply reports `AskUserQuestion` and suggests installing `lavish-axi`.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the four `setup-*` cases load with no error at zero cost

#### Scenario: Both decision surfaces graded

- **WHEN** the `setup-*` cases run
- **THEN** `setup-web-app` grades the Lavish line of the report and `setup-library` grades the `AskUserQuestion` line
