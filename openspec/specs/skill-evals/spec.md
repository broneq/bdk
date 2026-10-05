# skill-evals Specification

## Purpose

Defines BDK's skill measurement harness: repeatable, cost-capped runs of real Claude Code sessions with the BDK plugin on a pinned fixture repository, compared against an A/A noise floor, so decisions about skill style, rules and craft skills rest on measured differences.

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

The `with-without` suite SHALL take a skill name and a task file and run every task with the skill available and with it absent, all else equal, reporting per task and per metric whether the difference is measurable by the difference rule. A `bdk:<name>` skill runs on copies of the `bdk` plugin; a `bdk-craft:<name>` skill runs on copies of `plugins/bdk-craft` alone, without `bdk`, so the measurement also shows the skill working where `bdk` is absent. The `without` copy lacks the skill's directory in both cases.

#### Scenario: any skill

- **WHEN** `pnpm eval with-without --skill bdk:docs --tasks <file>` runs
- **THEN** each task runs in a `with` and a `without` cell and the report states for each metric whether the difference is measurable

#### Scenario: craft skill

- **WHEN** `pnpm eval with-without --skill bdk-craft:tdd --tasks <file>` runs
- **THEN** both cells load a copy of `plugins/bdk-craft` and no `bdk` plugin, and the `without` copy has no `skills/tdd/`

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

The `stages` suite SHALL run stage skills the way a user starts them: each case types the skill's slash command in a fresh copy of its base (the pinned fixture or an empty git repository, per case), answers every `AskUserQuestion` from the case's answers, which pair a pattern of the question with a pattern of the option (the first option when no pattern matches the question), and asserts on the kernel state the run leaves, read through kernel commands, and on git state no kernel command reports (a merge commit, the worktree list, a file's history), read through a shell command, not on the model's prose. A case MAY name a `seed`, a function of the suite that runs after the case's `prepare` lines in the working copy with the plugin copy's kernel and sets up state a shell line does not express well (a Change with plan parts, a verified design, a passed gate, a reviewed Change, a plan whose parts share a lockfile); `pnpm eval check` SHALL refuse a case that names an unknown seed. A case's `prepare` lines and its seed run in the working copy with the plugin copy's `bin/` first on `PATH`, so they call the kernel as `bdk <command>`, the form the skills use. A run SHALL fail when its transcript, the orchestrator's or a subagent's, holds a Bash tool call whose command names `bdk.mjs`, with a failure that names the call: agents call the kernel as `bdk <command>` (`kernel-cli`, Invocation, Entry points). Every stage skill SHALL have at least a happy-path case and a case in which the kernel refuses a command and the skill must follow `instead`. `pnpm eval stages --skill <name>` SHALL run the cases of one skill, and `--probe` SHALL behave as for every other suite.

#### Scenario: setup happy path

- **WHEN** `pnpm eval stages --skill setup --probe` runs its happy-path case on the fixture
- **THEN** the case passes when `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true` in the run's working copy

#### Scenario: setup without a linter or tests

- **WHEN** the cases `no-linter` and `no-tests` type `/bdk:setup` in an empty repository holding a Node project with only a test script, or only eslint, and answer that the project runs without the missing tool
- **THEN** each case passes when `bdk config check` exits 0, `bdk config show tools.lint` (or `tools.test`) answers `none`, the other group holds the detected command, and `bdk change new` afterwards exits 0; for `no-tests`, `bdk change status` holds the warning that the Change runs no test

#### Scenario: change refusal

- **WHEN** the refusal case of `change` types `/bdk:change <intent>` on a branch that already has an active Change and answers "stay on the current branch"
- **THEN** the case passes when no second Change exists and the final reply names the command that shows the existing Change (`/bdk:change` or `bdk change status`, from the refusal's `instead`), in whatever language it is written

#### Scenario: design happy path

- **WHEN** the happy-path case of `design` opens a `small` feature Change on the fixture in its preparation and types `/bdk:design`
- **THEN** the case passes when `bdk change status --json` reports `design` and `design-verify` done and `gate:design` ready

#### Scenario: verify-design blocker

- **WHEN** a case of `verify-design` prepares a done `design.md` that names a file the fixture does not have and types `/bdk:verify-design`
- **THEN** the case passes when `bdk log list --type blocker --json` holds a live blocker naming `design-verify` and `design-verify` is not done

#### Scenario: execute flat

- **WHEN** the `flat` case of `execute` seeds a `tiny` Change with two plan parts, the second depending on the first, and types `/bdk:execute`
- **THEN** the case passes when `execute-part:01` and `execute-part:02` are done, `bdk next --json` returns a node of the `review` stage and the final reply names `/bdk:cr`

#### Scenario: execute tree

- **WHEN** the `tree` case seeds a `large` Change with a passed design gate and two verified plan parts without `depends-on`, and types `/bdk:execute`
- **THEN** the case passes when both parts are done, each part has a `part-lead` attempt record closed `ok`, and `bdk next --json` returns a node of the `review` stage

#### Scenario: execute worktree

- **WHEN** the `worktree` case of `execute` uses seed `shared-lockfile`, a `large` Change with a passed design gate and two verified plan parts without `depends-on` and with disjoint `Files:`, whose tasks add different dependencies and so both regenerate the fixture's lockfile, part 02 with `isolation: worktree`, and types `/bdk:execute`
- **THEN** the case passes when both parts are done, home `HEAD` reaches a part merge commit carrying `BDK-Part: 02` and every task's trailer commit, `bdk log list --json` holds the entries of both parts, the lockfile holds both dependencies and was regenerated, not hand-merged (no conflict marker in its history; the merge ticket's `tests-scoped` manifest is `pass`), `git worktree list` holds only the working copy itself, and the final reply names `/bdk:cr`

#### Scenario: verify-plan flags a shared lockfile

- **WHEN** the `isolation` case of `verify-plan` uses seed `shared-lockfile-unisolated`, the plan of `shared-lockfile` with both parts `isolation: shared`, done and not verified, and types `/bdk:verify-plan`
- **THEN** the case passes when `bdk log list --type blocker --json` holds a live blocker of category `integration-failure` naming both parts, and `plan-verify` is not done

#### Scenario: close happy path

- **WHEN** the happy-path case of `close` seeds a reviewed `tiny` Change and types `/bdk:close`
- **THEN** the case passes when `.bdk/changes/archive/` holds the Change, `bdk change status --json` reports no active Change and the final reply holds the PR summary

#### Scenario: run to the review stage

- **WHEN** the case `run-auto` types `/bdk:run --auto "<intent>"` on the fixture without a Change, with `tools.test` configured and `tools.lint` declared `none`
- **THEN** the case passes when the Change is archived, its archived evidence holds no `lint` or `lint-full` manifest, and the final reply names both gates passed by policy, the review report and the entries deferred to be reviewed

#### Scenario: run stops at a manual gate

- **WHEN** the case `run-manual` types `/bdk:run "<intent>"` with the default `manual` gates
- **THEN** the case passes when `gate:design` is ready and not done, no plan part exists and the final reply names `/bdk:plan`

#### Scenario: kernel called by its bundle path

- **WHEN** a run's transcript holds a Bash call `node "/plugin/dist/bdk.mjs" next --json` and every expectation of the case holds
- **THEN** the case fails and the failure names that command

#### Scenario: prepare calls bdk

- **WHEN** a case's `prepare` line is `bdk config set features.lavish false >/dev/null`
- **THEN** it runs the plugin copy's kernel and the run starts with the setting written

#### Scenario: unknown seed

- **WHEN** a case file names `seed: missing` and `pnpm eval check` runs
- **THEN** it exits non-zero naming the case and the seed

#### Scenario: config check needs no credentials

- **WHEN** `pnpm eval check` runs
- **THEN** it renders and validates the `stages` suite config of every stage skill with a case file, without a model call

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

### Requirement: The execute probe counts kernel refusals

The `execute` stage probe SHALL record, per case, the number of kernel refusals its agents met, by refusal rule, in its results row, so a run is compared with an earlier one by number. An `execute` probe on the fixture meets acceptance when it passes 3/3, shows no `policy/missing-citation`, `input/invalid-envelope`, `policy/no-open-ticket`, `input/unknown-command` or `input/unknown-flag` refusal, and has fewer refusals in total than probe 2 of T41 (21).

#### Scenario: Counts in the results row

- **WHEN** `pnpm eval stages --skill execute --probe` finishes
- **THEN** its results row holds a count per refusal rule for each case

#### Scenario: A refusal of a fixed rule fails the acceptance check

- **WHEN** a probe row holds a `policy/missing-citation` refusal
- **THEN** the acceptance comparison reports the row as failing

### Requirement: Run cap and probe

Every session of a suite SHALL be capped by `--run-cap` (default 15 USD), passed to the provider as the session's `max_budget_usd`. No cap SHALL span runs, series or suites: a series runs every run it plans. `--probe` SHALL run one run per cell, then print the measured cost per cell and the projected cost of the full series, and start no further run.

#### Scenario: run cap

- **WHEN** `pnpm eval stages --skill execute --run-cap 8` starts a session
- **THEN** the session's `max_budget_usd` is 8, and a run that reports no cost is counted at 8 USD and discarded

#### Scenario: no cap across runs

- **WHEN** earlier series spent any amount
- **THEN** a new series or probe starts all its runs

#### Scenario: probe projection

- **WHEN** `pnpm eval execute-ab --probe` finishes
- **THEN** it prints each cell's cost and the projected cost of the full series with the configured runs per cell, and no further run starts

### Requirement: Stage probes count refusals from the run journal

After each run of the `stages` suite, the harness SHALL run `bdk diagnostics report --session <id> --json` in the run's fixture working directory and SHALL take `refusals` and `refusal:<rule>` of the results row from that report, so a probe row and a production report count refusals the same way. The count from the Bash tool results of the transcript SHALL stay in the row as `refusals-transcript`, and `pnpm eval report stages` SHALL name every run where the two totals differ.

The report covers every rule class, `guard`, `state` and `kernel` included, and counts guard blocks once in `guardBlocks`, not under `refusals`. A run whose report fails (no journal, a kernel error) keeps the transcript count in `refusals` and is marked with the metric `journal-missing: 1`.

#### Scenario: journal counts in the row

- **WHEN** `pnpm eval stages --skill execute --probe` finishes a run whose agents met three `policy/missing-evidence` refusals
- **THEN** the row holds `refusal:policy/missing-evidence: 3` taken from the report, and `refusals-transcript`

#### Scenario: totals differ

- **WHEN** a row's `refusals` and `refusals-transcript` differ
- **THEN** `pnpm eval report stages` lists the run with both totals

#### Scenario: no journal

- **WHEN** the fixture of a run holds no journal
- **THEN** the row's `refusals` is the transcript count and `journal-missing` is 1
