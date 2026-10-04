# Spec Delta

## Purpose

The review skills of the `bdk` plugin, `/bdk:cr` and `/bdk:pr-review`. `/bdk:cr` checks a Change against its contract in rounds of parallel reviewers, triages their entries and fixes blockers on the `review-fix` budget. `/bdk:pr-review` reviews pull requests without state and posts the confirmed result to GitHub.

## ADDED Requirements

### Requirement: Review skill shape

`/bdk:cr` and `/bdk:pr-review` SHALL live at `skills/tools/cr/SKILL.md` and `skills/tools/pr-review/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists. Each SHALL:

- start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill;
- stay at or below 200 lines in `SKILL.md`;
- name BDK skills, roles and agents with the `/bdk:` and `bdk:` namespace;
- name no model;
- set `disallowed-tools: Edit Write NotebookEdit`.

`cr` SHALL write state only through kernel commands and SHALL write no file of its own: there is no `.bdk/cr/` report. Its `allowed-tools` SHALL be:

- the kernel pair of `kernel-cli`, Invocation;
- `Agent`, `SendMessage`, `Skill`, `Read`, and `Bash(git diff *)` and `Bash(git log *)` for reading the range.

`cr` SHALL NOT set `disable-model-invocation`, so `/bdk:run` can start it through the `Skill` tool. Neither skill SHALL reference `scripts/bdk_run_state.py` or a v2 agent.

#### Scenario: cr writes no file

- **WHEN** the content test reads `skills/tools/cr/SKILL.md`
- **THEN** its frontmatter has `disallowed-tools: Edit Write NotebookEdit`, its `allowed-tools` holds no `Write(` grant, and its body names neither `.bdk/cr/` nor `bdk_run_state.py`

#### Scenario: no v2 agent named

- **WHEN** the content test reads every file under `skills/tools/cr/` and `skills/tools/pr-review/`
- **THEN** none names `bdk:code-reviewer`, `bdk:architecture-reviewer`, `bdk:duplicate-detector`, `bdk:dead-code-detector`, `bdk:static-analyse`, `bdk:test-runner` or `general-purpose`

### Requirement: cr works on a Change

`/bdk:cr` SHALL review the active Change of the branch.

When the branch has no active Change, it SHALL open one with:

```
bdk change new "<intent>" --inferred --kind review [--base <ref>]
```

The intent is one sentence derived from the branch name and the subjects of the commits in the range. `--base` is passed when the user gave `--base <ref>`.

When `bdk attempt open review-fix <change-id>` refuses with `policy/not-ready`, because the Change has not reached the review stage, `cr` SHALL dispatch nothing. It SHALL report the refusal's `why` and the stage command `bdk next` names.

#### Scenario: branch without a Change

- **WHEN** the user types `/bdk:cr` on a branch with two commits over `origin/HEAD` and no active Change
- **THEN** a Change of kind `review` with `source: inferred` exists, and its first round reviews the files of those two commits

#### Scenario: Change before the review stage

- **WHEN** the user types `/bdk:cr` while a plan part of the active Change is not executed
- **THEN** no package is built and no agent starts, and the final reply names the refusal and `/bdk:execute`

### Requirement: cr runs a review round

A round SHALL run on one ticket of `bdk attempt open review-fix <change-id>`. Before opening it, `cr` SHALL run `bdk review plan` with the user's `--full` or `--base <ref>`. When the plan has no group, `cr` SHALL open no ticket and SHALL report that nothing changed since the last review.

Then `cr` SHALL build one package per group with `bdk dispatch build <change-id> <role> <ticket> --group <id>`:

- a group of kind `part`, `unplanned` or `module` gets role `reviewer`, with `--range` from the plan, a `--file` for every file of the group and, for a part, `--part <nn>`;
- the group `integration` gets role `integration-reviewer`, with `--range`;
- one more package of role `runner` with `--group gate` runs the full gate (`tests-full`, `lint-full` and coverage) from its `Checks` section.

The user's focus text SHALL become `--focus <text>` of every reviewer and integration-reviewer package. `cr` SHALL load the `bdk:swarm` skill and start every package's agent in the background in one dispatch round, with `subagent_type` set to `bdk:` plus the package's `adapter` and the package path as the whole prompt, at most `execution.concurrency` at once. It SHALL resume an agent at most once, as the swarm skill says.

#### Scenario: packages of a planned Change

- **WHEN** `/bdk:cr` runs on an executed Change whose `review plan` returns the groups `p01`, `p02` and `integration`
- **THEN** the ticket holds the packages of `reviewer` for `p01` and `p02`, of `integration-reviewer` for `integration` and of `runner` for `gate`, and every `Agent` call's prompt is one package path

#### Scenario: nothing new to review

- **WHEN** `/bdk:cr` runs and `review plan` returns no group because no commit follows the last merged review
- **THEN** no ticket is opened and the final reply says that nothing changed since the last review, naming its head

### Requirement: Reviewer findings reach the ledger

Each reviewer SHALL write its findings with `bdk log add --ticket <ticket>@<group>`. Each finding that a rule forced SHALL carry the rule id as a `--ref`. Each reviewer SHALL store its report with `bdk log ingest --ticket <ticket>@<group>`. `cr` SHALL read the round's entries only through `bdk log list --since-ticket-start <ticket>` and `bdk log show`, never from an agent's reply.

#### Scenario: findings with rule ids

- **WHEN** `/bdk:cr` runs on the fixture Change, whose part `01` breaks rule `BDK-CQ-4` in `src/01-1.ts`
- **THEN** the ledger holds a `finding` with `group: p01`, a ref `src/01-1.ts` and a ref `BDK-CQ-4`, and `reports/` holds the reviewer report of group `p01` stored by `log ingest`

### Requirement: cr triages every entry of the round

When every agent of the round has returned, `cr` SHALL triage the round in the main thread.

- Every live `finding`, `blocker` and `observation` written under the round's ticket gets one level through `bdk log triage <id> <level>`. The level is judged against the intent, the accepted decisions, the configured `review.risks` and the category the reviewer gave.
- A `blocker` is an entry that must be fixed before the gate and names a P8 category.
- An entry that repeats another of the round is triaged `not-a-problem`, with `--reason` naming the entry it repeats.
- `cr` SHALL NOT change an entry's text, type or refs.

Then `cr` SHALL store the merged review with `bdk log ingest --ticket <ticket>@merge`, before it closes the ticket: the kernel refuses an `ok` or `fail` close of a `review-fix` ticket without it (`kernel-cli/attempt`, bdk attempt close). The report's `entries` name every entry written under the round's ticket; entries of earlier rounds it fixed are named in its body. Its body lists, per level, each entry's id and summary, then the gate's verdicts and diff coverage. `cr` SHALL then run `bdk log add report "<counts per level>" --ticket <ticket>@merge`.

#### Scenario: every entry triaged

- **WHEN** a round's reviewers wrote three findings and one observation, one finding repeating another
- **THEN** each of the four entries holds a `level`, the repeated one `not-a-problem` with a reason naming the other, and the round's `merge` report names all four

### Requirement: cr fixes blockers on the review-fix budget

After the merged report, `cr` SHALL check for blocking entries. An entry is blocking when the `review` verdict counts it (`kernel-pipeline`, Artifact kinds): a live `blocker` naming `review`, or a live entry triaged `blocker`. Triage `not-a-problem` resolves an entry, so it is never blocking.

- **No blocking entry.** `cr` SHALL run `bdk attempt close <ticket> ok`, whose `next.action` is `review-done`, then `bdk done review`.
- **Blocking entries.** `cr` SHALL close the ticket `fail` and act on `next.action`:
  - `retry` or `narrow`: start the next round; after `narrow` its ticket carries the narrower scope (`kernel-loops`, Scope narrowing), and the findings it drops stay in the ledger for the human;
  - `escalate`: open the next round with `bdk attempt open review-fix <change-id> --escalate` and start its agents on the `model` that `bdk dispatch build` returns;
  - `parked`: stop and report the kernel's question and resume command.

A round that starts while the Change holds blocking entries SHALL fix them first:

1. It builds an `implementer` package on its ticket and starts its agent.
2. It dispatches the ticket's `steps` in order under the same ticket.
3. It commits the fix with `bdk commit <change-id>`.
4. It resolves each blocking entry the fix addresses with `bdk log resolve <id> resolved --reason "<fix and commit>"`.
5. Only then does it run `review plan` and the review of the round.

#### Scenario: blocker fixed in the next round

- **WHEN** round 1 triages one finding as `blocker` and the next round's implementer fixes it
- **THEN** round 1 closed `fail`; the next round's ticket holds an `implementer` package embedding that finding; a commit with trailer `BDK-Ticket: <ticket>` exists; the finding is `resolved`; the round's `review plan` anchor is `delta`; the round closed `ok`; and the `review` node is done

#### Scenario: budget used up

- **WHEN** a round closes `fail` and `next.action` is `parked`
- **THEN** `cr` starts no further agent and its final reply names the park question and the `bdk change resume` command

### Requirement: cr review range

`cr` SHALL leave the range to `bdk review plan`:

- without flags it reviews the delta since the head of the last merged review, and the full range of the Change when there is none;
- `--full` reviews the full range;
- `--base <ref>` reviews from `git merge-base HEAD <ref>`.

A round that follows a fix SHALL review the delta (user decision 2026-10-03), and the gate runner runs the full gate on the whole Change in every round. The final reply SHALL name the anchor kind (`delta`, `full` or `base`), the range and the uncommitted tracked files `review plan` reports as `dirty`.

#### Scenario: second manual run

- **WHEN** `/bdk:cr` ran once on the Change, two commits followed, and the user types `/bdk:cr` again
- **THEN** the round's groups hold only the files of those two commits, and the final reply names the anchor `delta`

### Requirement: cr inline

With `--inline`, `cr` SHALL start no agent. It SHALL build the same packages under the same ticket and then work each package itself, one after another: it reads the package with `bdk dispatch show`, follows the role section it embeds, writes entries and stores the report under the package's `<ticket>@<group>`. It then triages and merges as without `--inline`. It SHALL NOT fix blockers: with blocking entries it closes the ticket `fail` and stops, naming the blockers and `/bdk:cr` without `--inline` as the way to fix them.

#### Scenario: inline round

- **WHEN** the user types `/bdk:cr --inline` on an executed Change
- **THEN** no `Agent` call is made, and the ledger holds a stored report for every group of the round and a `merge` report

### Requirement: cr reports from the kernel

`cr` SHALL run `bdk change checkpoint` before it reports, so no run leaves an uncommitted ledger. It SHALL end with a short report built from kernel output only:

- the Change and its kind, the rounds run and each one's outcome;
- the anchor kind and range;
- per level, the count and the ids of the entries;
- the blockers fixed and their commits;
- the verdicts of `tests-full` and `lint-full` and the diff coverage per test entry;
- the agents that failed;
- the next command from `bdk change status`: `/bdk:close` when `gate:review` is ready, or the resume command of a parked Change.

A partial round SHALL NOT be reported as complete.

#### Scenario: report after a passing round

- **WHEN** a round closes `ok` with one `should-fix` and one `nice-to-have` entry
- **THEN** the final reply names both entry ids under their levels, the gate verdicts and `/bdk:close`

### Requirement: pr-review reviews without state

`/bdk:pr-review <pr-url>... [--verify] [focus]` SHALL review each PR in a detached worktree of its head, with no ticket and no ledger write. The GitHub review is its durable output (user decision 2026-10-03, refining D1). For each PR it SHALL build a PR brief:

- the PR number, URL and title;
- the worktree path and the range `<merge-base>..<head>`;
- the stack parent;
- the draft state;
- the mode (`review` or `verify`) and the focus text;
- the intent: a few sentences from the PR description, the linked issues, the branch name and the commit subjects.

When the worktree holds a BDK Change for the head branch, active under `.bdk/changes/` or archived under `.bdk/changes/archive/`, the brief also names that Change's directory as the contract. The contract is `change.md`, the accepted `decision` entries of its `log/`, and `design.md`, `architecture.md` and `plan/` where they exist.

`pr-review` SHALL start the forked role `bdk:pr-reviewer` through the `Skill` tool, with the brief as its argument, one PR after another. A fork does not run concurrently with another (HOST-FACTS `fork-concurrency`), and a `bdk:reviewer` started through the `Agent` tool needs a dispatch package (`guard/dispatch-prompt`).

#### Scenario: PR of a BDK branch

- **WHEN** `/bdk:pr-review` runs on a PR whose head holds `.bdk/changes/archive/2026-10-01-login/`
- **THEN** the brief names that directory as the contract, and no file under `.bdk/` of the worktree or of the user's checkout changes

#### Scenario: PR without a Change

- **WHEN** `/bdk:pr-review` runs on a PR whose head holds no `.bdk/changes/`
- **THEN** the brief's intent comes from the PR description, issues, branch and commits, and names no contract directory

### Requirement: pr-review confirms before posting

`pr-review` SHALL parse each role result block, remove every worktree, show per PR the computed verdict, the full blocker list and the full nice-to-have list, and ask the user to confirm or override each verdict before any GitHub call. It SHALL post one review per PR, rendered only from `references/comment-templates.md`. A PR whose role returned no result block SHALL be reported as failed and not posted. On the user's own PR the event SHALL be `COMMENT`. `--verify` SHALL classify the previous review's threads and resolve only the threads it posted and found fixed.

#### Scenario: nothing posted before confirmation

- **WHEN** the role returns a `request-changes` result and the user overrides it to approve
- **THEN** exactly one review is posted for that PR, with event `APPROVE`, and its summary carries the override note

#### Scenario: failed reviewer

- **WHEN** the forked role returns no result block for one of two PRs
- **THEN** that PR is reported as failed, nothing is posted for it, and the other PR is confirmed and posted
