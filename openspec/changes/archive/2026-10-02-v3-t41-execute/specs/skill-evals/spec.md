## MODIFIED Requirements

### Requirement: Stage skill suite

The `stages` suite SHALL run stage skills the way a user starts them: each case types the skill's slash command in a fresh copy of its base (the pinned fixture or an empty git repository, per case), answers every `AskUserQuestion` from the case's answers, which pair a pattern of the question with a pattern of the option (the first option when no pattern matches the question), and asserts on the kernel state the run leaves, read through kernel commands, not on the model's prose. A case MAY name a `seed`, a function of the suite that runs after the case's `prepare` lines in the working copy with the plugin copy's kernel and sets up state a shell line does not express well (a Change with plan parts, a verified design, a passed gate); `pnpm eval check` SHALL refuse a case that names an unknown seed. Every stage skill SHALL have at least a happy-path case and a case in which the kernel refuses a command and the skill must follow `instead`. `pnpm eval stages --skill <name>` SHALL run the cases of one skill, and `--probe` SHALL behave as for every other suite.

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

#### Scenario: execute flat

- **WHEN** the `flat` case of `execute` seeds a `tiny` Change with two plan parts, the second depending on the first, and types `/bdk:execute`
- **THEN** the case passes when `execute-part:01` and `execute-part:02` are done, `bdk next --json` returns a node of the `review` stage and the final reply names `/bdk:cr`

#### Scenario: execute tree

- **WHEN** the `tree` case seeds a `large` Change with a passed design gate and two verified plan parts without `depends-on`, and types `/bdk:execute`
- **THEN** the case passes when both parts are done, each part has a `part-lead` attempt record closed `ok`, and `bdk next --json` returns a node of the `review` stage

#### Scenario: unknown seed

- **WHEN** a case file names `seed: missing` and `pnpm eval check` runs
- **THEN** it exits non-zero naming the case and the seed

#### Scenario: config check needs no credentials

- **WHEN** `pnpm eval check` runs
- **THEN** it renders and validates the `stages` suite config of every stage skill with a case file, without a model call
