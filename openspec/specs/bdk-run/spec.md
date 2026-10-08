# bdk-run Specification

## Purpose

Defines the `/bdk:run` orchestrator of the `bdk` plugin: how it turns an intent, an issue or a list of issues into a queue of OpenSpec Changes, runs the stage skills over each Change in order up to its pull request, keeps `run.json`, resumes from files, lets a Change wait for an unmerged blocker (D9), stops, and reports.

## Requirements

### Requirement: Configured project only

`/bdk:run` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/run/`) that runs in the main thread. It SHALL read the configuration with `bdk config show` before anything else. When the project is not configured or its configuration is invalid, the skill SHALL write no file, create no branch, start no stage, and reply with `BDK not configured: run /bdk:setup`, or that the configuration is invalid and `bdk config check` lists the problems.

#### Scenario: Unconfigured project stops

- **WHEN** `/bdk:run "add a total command"` runs in a git project without `.bdk/settings.yaml`
- **THEN** no `run.json` is written, no branch is created, no stage skill is called, and the reply says `BDK not configured: run /bdk:setup`

### Requirement: Queue from an intent, an issue or a list of issues

The skill SHALL take as arguments either one intent in the user's words, or one or more GitHub issue references (`#<n>`, `<n>`, `<owner>/<repo>#<n>`, an issue URL). An intent SHALL give a queue of one Change named in kebab-case with two to five words of the change. Each issue SHALL give one Change named `<n>-<slug>`; when an open Change directory `openspec/changes/<n>-*/` exists already, the skill SHALL use that name. The skill SHALL read each issue with `gh issue view <ref> --json number,title,body,state,url,blockedBy`, and stop, writing nothing, when `gh` fails, quoting the error. An issue's blockers SHALL be the issues its `blockedBy` field names and the issues a line of its body starting with `Blocked by` names; only blockers that are issues of the same queue SHALL count. The queue SHALL put every Change after the Changes that block it and otherwise keep the order the user gave. A cycle of blockers in the queue SHALL stop the skill before it writes anything, naming the issues of the cycle.

#### Scenario: Issue list ordered by blocked by

- **WHEN** `/bdk:run #1 #2` runs and issue 1 is blocked by issue 2
- **THEN** the queue holds the Change of issue 2 first and the Change of issue 1 second, and the entry of issue 1 names the Change of issue 2 as its blocker

#### Scenario: Intent

- **WHEN** `/bdk:run "add a total command"` runs in a configured project without a run
- **THEN** the queue holds one Change with a kebab-case name and no issue

#### Scenario: Cycle

- **WHEN** `/bdk:run #1 #2` runs and issue 1 is blocked by issue 2 and issue 2 by issue 1
- **THEN** no `run.json` is written, no branch is created, and the reply names issues 1 and 2 as a cycle

### Requirement: run.json written by the run

The skill SHALL be the only writer of `.bdk/runs/run.json`. It SHALL write the file before the first stage of a new queue, valid against the `run.json` schema of spec `bdk-cli/run`, and SHALL add the keys that `bdk run status` ignores: `base`, the base branch of the run, and per queue entry `intent` (the intent, for a Change from an intent) and `blocked-by` (the names of the queued Changes that block it, omitted when none). `mode` SHALL be `interactive` when the session can ask the user with `AskUserQuestion`, otherwise `non-interactive`. The skill SHALL set `current` to the Change it works on before it starts that Change's next stage. When the skill is started with arguments while `run.json` holds a Change that is not done, it SHALL change nothing and reply with the queue and that `/bdk:run` without arguments continues it; when every Change of the existing run is done, the new queue SHALL replace it.

#### Scenario: Run file of a new queue

- **WHEN** `/bdk:run #1 #2` starts on the branch `main` and issue 1 is blocked by issue 2
- **THEN** `run.json` holds `version` 1, `base` `main`, a `mode`, the queue in order with each entry's `issue`, `blocked-by` on the entry of issue 1, and `current` naming the Change of issue 2, and `bdk run status` exits 0 on it

#### Scenario: Unfinished run kept

- **WHEN** `/bdk:run #3` runs while `run.json` holds a Change whose stage is `plan`
- **THEN** `run.json` is unchanged, no stage skill is called, and the reply names the queue and `/bdk:run`

### Requirement: A branch per Change from the base branch

The base branch SHALL be the branch checked out when the queue is created, or, with a detached `HEAD`, the branch `origin/HEAD` names, else `main`. Before the first stage of a Change, the skill SHALL fetch the base branch from `origin` when that remote exists, and create the branch `<change>` from `origin/<base>` when it exists, else from `<base>`. Before any later stage it SHALL switch to the branch `<change>`. It SHALL NOT switch branches while `git status --porcelain` lists changes of another Change; it SHALL stop instead and name them. Every Change SHALL get its own branch and its own pull request into the base branch; the skill SHALL pass `--base <base>` to `/bdk:close`, and SHALL never stack a branch on another Change's branch, rebase, force-push or merge.

#### Scenario: Second Change starts from the base

- **WHEN** the first Change of a queue on base `main` has its pull request and the second Change starts
- **THEN** the branch of the second Change starts at the commit of `origin/main`, holds no commit of the first Change, and its pull request goes into `main`

#### Scenario: Dirty tree of another Change

- **WHEN** the run must switch to the next Change while `git status --porcelain` lists files changed on the current branch
- **THEN** no branch is switched or created, and the reply names the files and stops

### Requirement: Stages in order

A Change SHALL be `done` when `.bdk/runs/<change>/close/pr.md` exists. The stage of any other Change SHALL be read with `bdk run status --json` while its branch is checked out, because the Change's files live on its branch; the entries of Changes whose branch is not checked out SHALL NOT be used. For the current Change the skill SHALL call the stage skill with the `Skill` tool: `bdk:propose` with `#<issue>` or the intent and `--name <change>` for `propose`, `bdk:design <change>`, `bdk:plan <change>`, `bdk:execute <change>`, `bdk:auto-review <change>`, and `bdk:close <change> --base <base>` for `close`. It SHALL do no stage's work itself. Before `bdk:execute`, when `git status --porcelain -- openspec/changes/<change>/` lists files, the skill SHALL commit them through the `commit` skill (`bdk:commit`), because propose, design and plan leave them uncommitted and the execute lead builds only on a clean tree; it SHALL commit nothing else. When the stage is `plan` or later, the Change has no plan part, and `.bdk/runs/<change>/design/gate.md` does not hold `Gate: approved`, the stage to run SHALL be `design`. After a stage skill ends, including when its own text ends the turn with a report, the skill SHALL read the stage again and go on with the next stage, until the Change is `done`, and then with the next Change of the queue. While a stage waits for a background lead, the skill SHALL end its turn and continue the stage and then the run when the notification arrives.

#### Scenario: Stages of one Change in order

- **WHEN** `/bdk:run` runs a Change from `propose` and every stage reaches its end
- **THEN** the stage skills are called in the order propose, design, plan, execute, auto-review, close, and the Change ends `done` with `close/pr.md`

#### Scenario: Stage read on the Change's branch

- **WHEN** the current Change `add-count` is at stage `close` on its branch `add-count` and the branch `add-total` is checked out
- **THEN** the skill switches to `add-count` before it reads the stage, and calls `bdk:close` for it, not `bdk:propose`

#### Scenario: Planning files committed before execute

- **WHEN** the current Change reaches `execute` with its proposal, specs, design and plan uncommitted under `openspec/changes/<change>/`
- **THEN** `bdk:commit` runs for that directory before `bdk:execute`, and the execute lead finds a clean tree

#### Scenario: Design gate not approved

- **WHEN** the last design report of the current Change passes and `design/gate.md` is missing
- **THEN** the skill calls `bdk:design` for the Change, not `bdk:plan`

### Requirement: Resume from files

`/bdk:run` without arguments SHALL continue the queue of `run.json`: it SHALL take the stage of each Change from `close/pr.md` and `bdk run status --json` on the Change's branch (resume table, spec `bdk-cli/run`) and SHALL NOT run again a stage the files show as done. A Change whose stage is `done` SHALL NOT be started again. Without `run.json` and without arguments the skill SHALL ask the user what to run and write nothing.

#### Scenario: Resume after an interruption

- **WHEN** `/bdk:run` runs on a queue whose first Change is `done` and whose second Change is archived without `close/pr.md`
- **THEN** no stage skill runs for the first Change, `bdk:close` runs for the second Change without a new spec-conformance check or archive, and a pull request of the second Change is opened

### Requirement: Changes waiting on an unmerged blocker

Before the first stage of a Change, the skill SHALL check each Change its entry names in `blocked-by`: the blocker is merged when it is `done` and `gh pr view <url> --json state` of the pull request in its `close/pr.md` prints `MERGED`. When a blocker is not merged, the skill SHALL NOT start the Change (no branch, no stage skill), SHALL go on with the next Change of the queue, and SHALL list the waiting Change with its blockers and their pull requests in its report. A Change that has started SHALL NOT be checked again. A later `/bdk:run` SHALL start a waiting Change once its blockers are merged.

#### Scenario: Blocker of the queue not merged

- **WHEN** the queue holds Change A and Change B blocked by A, and A ends with an open pull request
- **THEN** no branch, Change directory or stage skill call exists for B, and the reply names B as waiting on A and A's pull request

#### Scenario: Blocker merged

- **WHEN** `/bdk:run` runs again after the pull request of A was merged
- **THEN** B gets its branch from the fetched base branch and its stages start

### Requirement: Stop when a stage does not reach its end

When a stage skill ends and the stage of the current Change has not moved past it (a question or gate for the user, a blocked part, a spent budget, a failing check, a failed push), the skill SHALL stop the run: it SHALL start no other Change, and reply with the Change, the stage, the stage's own reason, and that `/bdk:run` continues once the cause is resolved. The skill SHALL NOT answer a stage's question or pass a gate for the user; a stage asks or decides by its own policy.

#### Scenario: Blocked execute stops the run

- **WHEN** `/bdk:execute` ends with `Status: blocked` for the first Change of a two-Change queue
- **THEN** no stage skill runs for the second Change, and the reply names the first Change, `execute`, its blockers and `/bdk:run`

### Requirement: Final report

When every Change of the queue is `done` or waiting, the skill SHALL reply with one line per Change in queue order: the pull request URL and base from `close/pr.md`, or `waiting` with its blockers; then every decision taken without the user, read from the run files of each Change (the decisions of the pull request body in `close/pr.md`, which `/bdk:close` gathers from `proposal.md` and `design.md`, and `## Decisions taken without the user` of `review/result.md`); and, when a Change waits, that `/bdk:run` continues after its blockers are merged. It SHALL NOT merge a pull request.

#### Scenario: Two pull requests reported

- **WHEN** both Changes of a queue end `done`
- **THEN** the reply names both pull request URLs, each into the base branch

### Requirement: Eval cases of the run

The `bdk` eval suite SHALL hold `orchestrator` cases for `/bdk:run`, run with the offline `gh` stand-in and a bare remote inside the workspace: `run-two-prs` (a queue of two reviewed Changes ends with two pull requests into `main`), `run-resume` (a queue interrupted after the archive of its second Change resumes at the pull request, with nothing run again for the first Change), `run-waiting-blocker` (a Change blocked by an unmerged Change of the queue is not started and is reported as waiting) and `run-queue-from-issues` (two issues are queued in "blocked by" order and the first Change gets its branch from `main` and its proposal). Each SHALL grade the order of the stages, the files the run writes and the outcome.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the four `run-*` cases load with no error at zero cost and their scaffolds exit 0
