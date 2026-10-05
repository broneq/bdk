## MODIFIED Requirements

### Requirement: Stage skill suite

The `stages` suite SHALL run stage skills the way a user starts them: each case types the skill's slash command in a fresh copy of its base (the pinned fixture or an empty git repository, per case), answers every `AskUserQuestion` from the case's answers, which pair a pattern of the question with a pattern of the option (the first option when no pattern matches the question), and asserts on the kernel state the run leaves, read through kernel commands, and on git state no kernel command reports (a merge commit, the worktree list, a file's history), read through a shell command, not on the model's prose. A case MAY name a `seed`, a function of the suite that runs after the case's `prepare` lines in the working copy with the plugin copy's kernel and sets up state a shell line does not express well (a Change with plan parts, a verified design, a passed gate, a reviewed Change, a plan whose parts share a lockfile); `pnpm eval check` SHALL refuse a case that names an unknown seed. A case's `prepare` lines and its seed run in the working copy with the plugin copy's `bin/` first on `PATH`, so they call the kernel as `bdk <command>`, the form the skills use. A run SHALL fail when its transcript, the orchestrator's or a subagent's, holds a Bash tool call whose command names `bdk.mjs`, with a failure that names the call: agents call the kernel as `bdk <command>` (`kernel-cli`, Invocation, Entry points). Every stage skill SHALL have at least a happy-path case and a case in which the kernel refuses a command and the skill must follow `instead`. `pnpm eval stages --skill <name>` SHALL run the cases of one skill, and `--probe` SHALL behave as for every other suite.

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

- **WHEN** the case `run-auto` types `/bdk:run --auto "<intent>"` on the fixture without a Change
- **THEN** the case passes when every `execute-part` instance is done, `bdk next --json` returns the `review` node and the final reply names `/bdk:cr`

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
