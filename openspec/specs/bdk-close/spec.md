# bdk-close Specification

## Purpose

Defines the `/bdk:close` orchestrator of the `bdk` plugin: how it ends a reviewed OpenSpec Change - commits work left in the tree, checks the spec deltas with `spec-conformance`, archives the Change into the main specs, commits the archive, pushes the branch and opens a pull request into the base branch - and how it stops and resumes.

## Requirements

### Requirement: Configured project only

`/bdk:close` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/close/`) that runs in the main thread. It SHALL read the configuration with `bdk config show` before anything else. When the project is not configured or its configuration is invalid, the skill SHALL start no block, run no command that writes, and reply with `BDK not configured: run /bdk:setup`, or that the configuration is invalid and `bdk config check` lists the problems.

#### Scenario: Unconfigured project stops

- **WHEN** `/bdk:close` runs in a git project without `.bdk/settings.yaml`
- **THEN** no agent is started, no commit is made, nothing is archived, and the reply says `BDK not configured: run /bdk:setup`

### Requirement: Change, base branch and branch

The skill SHALL take the arguments `[<change>] [--base <ref>]`. The Change SHALL be the first argument, else the only directory under `openspec/changes/` other than `archive/`, else the only Change named in `.bdk/runs/run.json` as `current`; with none or several, the skill SHALL name what it found and stop. A Change already archived (`openspec/changes/archive/<date>-<change>/`) SHALL be accepted. The base branch SHALL be `--base` when given, else the branch `git symbolic-ref --short refs/remotes/origin/HEAD` names without its remote, else `main`. When the current branch is the base branch or `HEAD` is detached, the skill SHALL create the branch `<change>` at `HEAD` and switch to it before it commits; when a branch `<change>` exists already, it SHALL stop and name that branch instead. Otherwise the current branch is the Change's branch.

#### Scenario: Base from the remote

- **WHEN** `/bdk:close add-total` runs without `--base` in a repository whose `origin/HEAD` points to `origin/main`
- **THEN** the base branch is `main`

#### Scenario: Started on the base branch

- **WHEN** `/bdk:close add-total --base main` runs while `main` is checked out
- **THEN** the skill creates and checks out the branch `add-total` before its first commit, and `main` keeps its commits

#### Scenario: Change branch exists already

- **WHEN** `/bdk:close add-total --base main` runs while `main` is checked out and a branch `add-total` exists
- **THEN** nothing is committed, archived or pushed, and the reply names the branch `add-total`

### Requirement: Stage check through the run

When `.bdk/runs/run.json` exists and its queue holds the Change, the skill SHALL run `bdk run status --json` before any block. When that Change's stage is earlier than `close` (`propose`, `design`, `plan`, `execute` or `auto-review`), the skill SHALL stop, run no block, and name the stage, its reason and the command of that stage. When the stage is `done`, the skill SHALL reply with the pull request recorded in `close/pr.md` and do nothing else. Without `run.json`, the user's command is the consent to close, and the skill SHALL go on.

#### Scenario: Open blocker in the run

- **WHEN** `/bdk:close add-total` runs and `bdk run status --json` reports the Change at stage `auto-review`, step `triage`
- **THEN** no agent is started, nothing is committed or archived, and the reply names `auto-review`, the reason and `/bdk:auto-review`

### Requirement: Blocks in order

The skill SHALL compose these steps in this order and never do a block's work itself:

1. commit the work left in the tree, when `git status --porcelain` lists any change, through the `commit` skill;
2. start `spec-conformance` on the `bdk:verifier` agent (`Agent`, `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:spec-conformance with the arguments: <change> --base <diff base>`, the diff base being `origin/<base>` when that remote branch exists, else `<base>`, and `model` `models.verifier` when the configuration sets it) and read the first line of `.bdk/runs/<change>/close/spec-conformance.md`;
3. archive the Change with `openspec archive <change> --yes`;
4. commit the archive through the `commit` skill;
5. push the branch and open the pull request.

Before each step it SHALL tell the user in one line what runs and what it writes.

#### Scenario: Conforming Change closed

- **WHEN** `/bdk:close add-total` runs on the branch `add-total` of a configured project whose Change conforms to the code, with a remote `origin` and the base `main`
- **THEN** the `bdk:verifier` agent runs before `openspec archive add-total --yes`, the archive is committed on `add-total`, the branch is pushed to `origin`, and `gh pr create` runs with `--base main` and `--head add-total`

#### Scenario: Work left in the tree

- **WHEN** `/bdk:close add-total` runs with uncommitted changes to the code of the Change
- **THEN** the `commit` skill commits them before the `bdk:verifier` agent starts, so the verifier's `git diff <base>...HEAD` holds them

#### Scenario: Verifier model

- **WHEN** `/bdk:close add-total` runs in a project whose configuration sets `models.verifier: sonnet`
- **THEN** the `bdk:verifier` agent starts with `model` `sonnet`

### Requirement: Stop on a failing spec-conformance report

When the report's first line is not `Verdict: PASS`, or the agent wrote no report, the skill SHALL stop before the archive: no `openspec archive`, no archive commit, no push and no pull request. It SHALL reply with the verdict, the report path and the `Must address` IDs, and say that the fix goes to the side the report names (the code, or the spec deltas of the Change) and that `/bdk:close <change>` runs again after it. The skill SHALL NOT edit a spec delta, a main spec or code to make the check pass.

#### Scenario: Contradicted scenario

- **WHEN** `/bdk:close add-total` runs and the code of `tally total` exits 1 on an empty ledger while the delta says it prints `Total: 0.00` and exits 0
- **THEN** `close/spec-conformance.md` starts with `Verdict: FAIL`, `openspec/changes/add-total/` still exists, no `gh pr create` runs, and the reply names the report path and its `Must address` IDs

### Requirement: Archive and its commit

The skill SHALL archive with `openspec archive <change> --yes`, which merges the spec deltas into `openspec/specs/` and moves the Change under `openspec/changes/archive/`; a Change with `skip_specs: true` is archived the same way. When the command exits non-zero, the skill SHALL stop, quote its error, and neither commit nor push. After the archive it SHALL commit `openspec/` through the `commit` skill, with arguments that limit the commit to `openspec/` and name the archived Change, and the commit SHALL follow the project's convention as that skill finds it.

#### Scenario: Specs merged and committed

- **WHEN** the archive of `add-total` succeeds
- **THEN** `openspec/specs/tally/spec.md` holds the requirement `Total`, `openspec/changes/archive/<date>-add-total/proposal.md` exists, and `git status --porcelain -- openspec/` is empty

#### Scenario: Archive refused

- **WHEN** `openspec archive add-total --yes` exits non-zero because a delta is invalid
- **THEN** the skill makes no commit for the archive, does not push, and the reply quotes the `openspec` error

### Requirement: Pull request into the base branch

The skill SHALL push the branch with `git push -u origin <branch>` and SHALL NOT pass `--force` or `--force-with-lease`. It SHALL then run `gh pr view <branch> --json url,state`: an open pull request of the branch SHALL be reused; otherwise it SHALL run `gh pr create --base <base> --head <branch> --title <title> --body-file .bdk/runs/<change>/close/pr-body.md`. The title SHALL follow the project's commit convention and say what the Change does. The body SHALL hold what the Change does, `Resolves #<n>` when the issue is known (the `issue` of the Change in `run.json`, or the issue the first line under Why of `proposal.md` names), the capabilities whose main specs changed, the spec-conformance verdict, the E2E verdict or that no E2E results exist, the number of review rounds or that no review round ran, and every decision taken without the user (the bullets of `## Decided without the user` of `proposal.md`, the `Decided without the user:` lines of `design.md`, and the bullets of `## Decisions taken without the user` of `review/result.md`, auto triage lines included, each group named by its source; a `- None.` bullet or a missing file adds nothing), or that there were none, and, when `## Deferred` of `review/result.md` holds a bullet other than `- None.`, a `Deferred` part with every bullet of that section as written (place, summary, level, and the issue when it has one), in its order, `nice-to-have` findings without an issue included; with no such bullet the part is left out. When the push or `gh` fails, the skill SHALL stop, quote the error, and write no `close/pr.md`; the archive and its commit stay.

#### Scenario: Pull request body

- **WHEN** the close of `add-total` creates its pull request
- **THEN** `gh pr create` runs with `--base main`, and the body file names the capability `tally`, `Verdict: PASS` of spec conformance and the E2E verdict

#### Scenario: No remote

- **WHEN** the repository has no remote `origin`
- **THEN** the Change stays archived and committed, no `close/pr.md` is written, and the reply quotes the `git push` error and says that the push and pull request remain

#### Scenario: Existing pull request

- **WHEN** `gh pr view add-total --json url,state` reports an open pull request
- **THEN** the skill pushes without force, runs no `gh pr create`, and records that pull request's URL

#### Scenario: Review decisions in the pull request body

- **WHEN** the close of `add-total` creates its pull request and `review/result.md` lists under `## Decisions taken without the user` the line `Round 1: triage by policy.gates.review auto.` and a product decision of the fix pass
- **THEN** the decisions part of the body file holds both lines, named as the review's, and does not read `none`

#### Scenario: Deferred findings in the pull request body

- **WHEN** the close of `add-total` creates its pull request and `review/result.md` lists under `## Deferred` a `should-fix` finding with issue `#12` and a `nice-to-have` finding without an issue
- **THEN** the body file has a `Deferred` part that holds both bullets, the issue `#12` included

### Requirement: Close record

After the pull request is created or reused, the skill SHALL write `.bdk/runs/<change>/close/pr.md` whose first three lines are `PR: <url>`, `Base: <base>` and `Branch: <branch>`, followed by a blank line and the body. It SHALL write this file last, so that `bdk run status` reports the Change `done` only when the pull request exists. The reply SHALL name the pull request URL, the base branch, the archive path, the commits made, every decision taken without the user, and the deferred findings of the body's `Deferred` part.

#### Scenario: Run status after close

- **WHEN** the close of `add-total` has opened its pull request and `bdk run status` runs on a run that queues `add-total`
- **THEN** the stage of `add-total` is `done`

### Requirement: Resume from the first missing step

The skill SHALL start at the first missing step of row 9 of the resume table (spec `bdk-cli/run`): a Change already archived SHALL NOT be checked or archived again, an archive not yet committed SHALL be committed, and a branch whose pull request is open SHALL be pushed and recorded without a new pull request. A Change not yet archived SHALL be checked again even when an earlier report passed, because the code may have changed since; the verifier carries the earlier report's IDs over.

#### Scenario: Archived, no pull request

- **WHEN** `/bdk:close add-total` runs after an earlier close archived and committed the Change and then failed to push
- **THEN** no `bdk:verifier` agent starts and no `openspec archive` runs, the branch is pushed, and the pull request is opened

### Requirement: No stacking, no rewritten history

The skill SHALL open the pull request into the base branch only, never into the branch of another Change. It SHALL NOT rebase, reset, amend, or force-push, and SHALL NOT merge the pull request. Besides the commits, it SHALL write only `.bdk/runs/<change>/close/pr-body.md` and `close/pr.md`.

#### Scenario: Base branch moved on

- **WHEN** `origin/main` has commits the branch `add-total` does not have
- **THEN** the skill pushes `add-total` as it is and opens the pull request into `main` without a rebase
