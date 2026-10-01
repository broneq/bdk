# skill-evals Specification

## Purpose

Defines BDK's skill measurement harness: repeatable, budget-capped runs of real Claude Code sessions with the BDK plugin on a pinned fixture repository, compared against an A/A noise floor, so decisions about skill style, rules and craft skills rest on measured differences.

## Requirements

### Requirement: One command per suite on a clean machine

Each suite (`execute-ab`, `rules-noop`, `with-without`) SHALL run with one command, `pnpm eval <suite>`, on a machine that has the repository's pinned Node and pnpm, git, Claude Code, network access and credentials (`ANTHROPIC_API_KEY`, or a Claude Code login), with no other manual setup. Without credentials the command SHALL exit non-zero before any model call and name both ways to provide them. An unknown suite name SHALL exit non-zero and list the known suites.

#### Scenario: clean clone runs a suite

- **WHEN** a fresh clone runs `pnpm install` and then `pnpm eval rules-noop --probe` with `ANTHROPIC_API_KEY` set
- **THEN** the harness fetches its pinned tools and the fixture itself, runs the probe and writes its results, with no further manual step

#### Scenario: missing credentials

- **WHEN** `pnpm eval execute-ab` runs without `ANTHROPIC_API_KEY` and Claude Code is not logged in
- **THEN** it exits non-zero, names `ANTHROPIC_API_KEY` and `claude auth login`, and no model call is made

#### Scenario: Claude Code login instead of a key

- **WHEN** `pnpm eval rules-noop --probe` runs without `ANTHROPIC_API_KEY` and `claude auth status` reports a login
- **THEN** the probe runs

#### Scenario: unknown suite

- **WHEN** `pnpm eval nosuch` runs
- **THEN** it exits non-zero and lists `execute-ab`, `rules-noop` and `with-without`

### Requirement: Pinned, isolated fixture per run

The harness SHALL fetch the fixture repository at its pinned commit and refuse to run when the fetched tree does not match that commit. It SHALL remove the fixture's own agent configuration and instructions (`.claude/`, `.agents/`, `CLAUDE.md`, `AGENTS.md`) and start every run from a fresh copy, so no run sees another run's changes. A run whose session log shows a plugin other than its arm's copy, enabled claude.ai connectors, or an MCP tool call SHALL be discarded and not counted.

#### Scenario: fresh copy per run

- **WHEN** two consecutive runs of the same cell execute and the first one commits changes
- **THEN** the second run starts from the pinned commit's tree without the first run's commits or files

#### Scenario: commit mismatch

- **WHEN** the fetched fixture's HEAD differs from the pinned commit
- **THEN** the harness exits non-zero before any model call and prints both commits

#### Scenario: isolation leak

- **WHEN** a run's session log shows a second directory-loaded plugin or an MCP tool call
- **THEN** the run is marked discarded with the reason and is not counted in any metric

### Requirement: Three-arm execute measurement

The `execute-ab` suite SHALL run the same fixture task in three arms: `v2` (the v2 `subagent-execute-plan` skill from tag `v2.7.0` on a v2 plan), `v3-long` (an execute skill that writes the step order itself and calls the stage commands) and `v3-thin` (an execute skill of at most 200 lines that loops `bdk next`, does the step and reports). For every run it SHALL record acceptance-test outcome, step completeness, cost, turns and wall time; for the v3 arms also the count of `bdk` calls, the count of `bdk` calls that exit 3 (`input/`), the count that exit 2 (refusal), and the length of the returned envelopes.

#### Scenario: thin variant size

- **WHEN** the `v3-thin` variant's SKILL.md is measured
- **THEN** it has at most 200 lines

#### Scenario: per-run metrics

- **WHEN** a `v3-thin` run finishes
- **THEN** its result row holds the acceptance-test outcome, step completeness, cost, turns, wall time, `bdk` call count, exit-3 count, exit-2 count and envelope length

#### Scenario: v2 arm without kernel metrics

- **WHEN** a `v2` run finishes
- **THEN** its result row holds the acceptance-test outcome, step completeness, cost, turns and wall time, and marks the kernel metrics as not applicable

### Requirement: A/A noise floor and the difference rule

Every suite that compares two configurations SHALL also run one configuration twice as an A/A pair with the same number of runs per cell (5 by default). A difference between two cells SHALL count only when the gap between their medians exceeds the larger within-cell range (max - min) of the two cells; a smaller gap SHALL be reported as "no measurable difference", never as a win or a loss.

#### Scenario: gap inside the noise

- **WHEN** cell A has values 0.6, 0.8, 0.8, 1.0, 1.0 and cell B has 0.8, 0.8, 1.0, 1.0, 1.0
- **THEN** the comparison is reported as "no measurable difference" (median gap 0.2 does not exceed range 0.4)

#### Scenario: gap outside the noise

- **WHEN** cell A has values 0.2, 0.2, 0.4, 0.4, 0.4 and cell B has 0.8, 1.0, 1.0, 1.0, 1.0
- **THEN** the comparison is reported as a difference in favour of B (median gap 0.6 exceeds range 0.2)

### Requirement: Rules no-op measurement

The `rules-noop` suite SHALL produce, for every rule of the BDK pack (`rule-pack`, Pack layout: one file per rule under `rules/<category>/` and `rules/languages/<name>/`), the outcome of a blind knowledge test on Haiku 4.5 and on Sonnet 5 graded by one judge as COVERED, MISSED or WRONG, and, for every rule with a seeded violation, the detection rate of a review with the pack's rules and without them, compared by the difference rule. A rule without a seeded violation SHALL be marked "not seedable" in the ablation columns. The rows measured before the pack migration keep their T40 bullet ids, which `docs/V3-RULES-MIGRATION.md` maps to the pack ids. `pnpm eval rules-noop --patches <name,...>` SHALL run the ablation of the named patches only, without the knowledge test, so a re-seeded rule or a new language pack is measured without repeating the whole series.

#### Scenario: per-bullet row

- **WHEN** the suite finishes
- **THEN** its table has one row per rule with the file, the rule text, the Haiku and Sonnet knowledge outcomes, the with-rules and without-rules detection rates or "not seedable", and a provisional class

#### Scenario: patch filter

- **WHEN** `pnpm eval rules-noop --patches 22-operator-toolkit --probe` runs
- **THEN** only the ablation of that patch runs, and an unknown patch name exits 2 naming it

### Requirement: With / without mode for any skill

The `with-without` suite SHALL take a skill name and a task file and run every task with the skill available and with it absent, all else equal, reporting per task and per metric whether the difference is measurable by the difference rule.

#### Scenario: any skill

- **WHEN** `pnpm eval with-without --skill bdk:mermaid-drawer --tasks <file>` runs
- **THEN** each task runs in a `with` and a `without` cell and the report states for each metric whether the difference is measurable

### Requirement: Budget stop and probe

Every suite SHALL print the running cost after each run and stop starting new runs once the spent cost reaches the budget (default 100 USD, `--budget` overrides). `--probe` SHALL run one run per cell, then print the measured cost per cell and the projected cost of the full series, and start no further run.

#### Scenario: budget reached

- **WHEN** the spent cost reaches the budget during a series
- **THEN** no new run starts, the results so far are written, and the command exits non-zero naming the budget

#### Scenario: probe projection

- **WHEN** `pnpm eval execute-ab --probe` finishes
- **THEN** it prints each cell's cost and the projected cost of the full series with the configured runs per cell, and no further run starts

### Requirement: Run provenance

Every result row SHALL carry the orchestrator and subagent model ids reported by the session, the fixture commit, the BDK commit of each plugin copy, the hash of the skill variant, and for the v3 arms the `template-hash` values of the dispatch packages built during the run (P10).

#### Scenario: provenance fields

- **WHEN** a `v3-long` run finishes
- **THEN** its row holds the model ids, the fixture commit, the BDK commit, the variant hash and the `template-hash` of every dispatch package of the run

### Requirement: Model-free CI check

CI SHALL validate every suite's configuration and run the harness unit tests on every pull request without calling a model and without credentials.

#### Scenario: CI without a key

- **WHEN** the tests workflow runs on a pull request
- **THEN** the eval config check and harness unit tests pass without any model call

### Requirement: Measurement reports

The repository SHALL hold two reports: `docs/V3-EVAL-EXECUTE-AB.md` with the A/A noise floor, per-arm medians and ranges, the decision criterion as written before the runs, and the decision (thin skills, or fallback to approach B for T41); and `docs/V3-EVAL-RULES-NOOP.md` with the noise floor, the per-bullet table and its provisional classes handed to T31.

#### Scenario: execute report

- **WHEN** `docs/V3-EVAL-EXECUTE-AB.md` is read
- **THEN** it states the noise floor, the three arms' numbers, the pre-registered criterion and one decision: thin skills or fallback B

#### Scenario: rules report

- **WHEN** `docs/V3-EVAL-RULES-NOOP.md` is read
- **THEN** it states the noise floor and has one table row per rule bullet

### Requirement: Stage skill suite

The `stages` suite SHALL run stage skills the way a user starts them: each case types the skill's slash command in a fresh copy of its base (the pinned fixture or an empty git repository, per case), answers every `AskUserQuestion` from the case's answers, which pair a pattern of the question with a pattern of the option (the first option when no pattern matches the question), and asserts on the kernel state the run leaves, read through kernel commands, not on the model's prose. Every stage skill SHALL have at least a happy-path case and a case in which the kernel refuses a command and the skill must follow `instead`. `pnpm eval stages --skill <name>` SHALL run the cases of one skill, and `--probe` SHALL behave as for every other suite.

#### Scenario: setup happy path

- **WHEN** `pnpm eval stages --skill setup --probe` runs its happy-path case on the fixture
- **THEN** the case passes when `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true` in the run's working copy

#### Scenario: change refusal

- **WHEN** the refusal case of `change` types `/bdk:change <intent>` on a branch that already has an active Change and answers "stay on the current branch"
- **THEN** the case passes when no second Change exists and the final reply names the command that shows the existing Change (`/bdk:change` or `bdk change status`, from the refusal's `instead`), in whatever language it is written

#### Scenario: design happy path

- **WHEN** the happy-path case of `design` opens a `small` feature Change on the fixture in its preparation and types `/bdk:design`
- **THEN** the case passes when `bdk change status --json` reports `design` and `design-verify` done and `gate:design` ready

#### Scenario: verify-design blocker

- **WHEN** a case of `verify-design` prepares a done `design.md` that names a file the fixture does not have and types `/bdk:verify-design`
- **THEN** the case passes when `bdk log list --type blocker --json` holds a live blocker naming `design-verify` and `design-verify` is not done

#### Scenario: config check needs no credentials

- **WHEN** `pnpm eval check` runs
- **THEN** it renders and validates the `stages` suite config of every stage skill with a case file, without a model call

### Requirement: Retirement of tests/evals

`tests/evals/` SHALL carry a notice that it is superseded by `evals/` and is removed in T32, and T32's scope in the implementation plan SHALL list its removal. New skill evals SHALL go to `evals/`.

#### Scenario: notice present

- **WHEN** `tests/evals/README.md` is read
- **THEN** it names `evals/` as the replacement and T32 as the task that removes the directory
