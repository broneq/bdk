## MODIFIED Requirements

### Requirement: run decides instead of asking

While a run lasts, wherever a stage skill would ask the user (Requirement: Asking the user in two tiers), the run SHALL take the recommended option and record it with `bdk log add decision <summary> --review`, naming the question and the options it did not take. The decision then appears at the next gate and in the PR summary (R-9).

The human report of `/bdk:cr` is recorded differently: the run SHALL NOT stop at it, with or without `--auto` (user decision 2026-10-04). Each entry without a disposition is recorded with `bdk log decide <id> defer --review`, so it reaches the gate and the PR summary as deferred and to be reviewed. No `fix` is ever chosen for the user. At its stop the run SHALL name the report path and `/bdk:cr --report` as the way to change those dispositions.

A park question of the attempt ladder is not a stage skill's question: it parks the Change and stops the run.

#### Scenario: branch question inside a run

- **WHEN** `/bdk:change`, started by a run, reaches its branch question
- **THEN** no `AskUserQuestion` call is made and the ledger holds a `decision` entry with `review: true` naming the branch it chose

#### Scenario: report inside an auto run

- **WHEN** `/bdk:run --auto "<intent>"` reaches the review with one `should-fix` entry left
- **THEN** the run does not stop at the report, the entry is decided `defer` with `review: true`, `bdk change close` succeeds, and its `summary` lists the entry as deferred and to be reviewed

## ADDED Requirements

### Requirement: setup detects the tracker

`/bdk:setup` SHALL propose a `tracker` value while none is set (`kernel-settings`, Keys of review policy):

- When `gh auth status` succeeds and the `origin` remote is on `github.com`, it SHALL propose `{kind: github}`.
- Otherwise it SHALL ask whether findings go to another tracker. When the user names one, it SHALL write `{kind: instruction, instruction: <text>}` with the user's description of how to file an issue.

A declined proposal leaves `tracker` unset. The value is written with `bdk config set tracker`.

#### Scenario: GitHub project

- **WHEN** `/bdk:setup` runs where `gh auth status` succeeds, `origin` is `git@github.com:acme/app.git` and the user accepts
- **THEN** `bdk config show tracker --json` reports `{kind: github}` from the project layer

#### Scenario: no tracker

- **WHEN** `origin` is not on GitHub and the user names no tracker
- **THEN** `tracker` stays unset and the Finish report says that the report offers no `track`
