# skill-evals Specification

## Purpose

Defines how the skills of the `bdk` plugin are measured with `claude plugin eval`: where cases and shared fixtures live, how block and orchestrator cases are graded, how a contributor runs the suite, and what PR CI checks for free.

## Requirements

### Requirement: Suite layout

The eval cases of the `bdk` plugin SHALL live under `plugins/bdk/evals/`, one directory per case named `<block>-<case>` in kebab-case, where `<block>` is the name of the skill the case measures. Directories that are not cases SHALL be only `fixtures/` and `results/`. Run results under `plugins/*/evals/results/` SHALL be ignored by git, and the released plugin SHALL hold no `evals/` directory.

#### Scenario: Case names

- **WHEN** the directories directly under `plugins/bdk/evals/` other than `fixtures/` and `results/` are listed
- **THEN** each name is kebab-case with at least two segments, and each holds a `prompt.md` or a `case.yaml`

#### Scenario: Results are not committed

- **WHEN** a run writes `plugins/bdk/evals/results/<timestamp>/` and `git status` runs
- **THEN** no path under it is listed

### Requirement: Shared fixtures

A fixture used by more than one case SHALL be a script `plugins/bdk/evals/fixtures/<name>.sh` that builds a workspace in its current directory from files and git state only, with no network access, and exits 0 within 120 seconds. A case SHALL use it from its own `scaffold_script` by a path relative to that script, and SHALL NOT keep a copy of it.

#### Scenario: Fixture runs alone

- **WHEN** a fixture script runs in an empty directory with only `PATH`, a temporary `HOME` and `TMPDIR`, and `TERM=dumb` set
- **THEN** it exits 0 within 120 seconds and the directory is no longer empty

#### Scenario: Case scaffold reuses a fixture

- **WHEN** a case's `scaffold_script` runs from the case directory's path in an empty workspace
- **THEN** it builds the workspace through the shared fixture script and exits 0

### Requirement: Block and orchestrator cases

A case of a block SHALL carry the tag `block`, run with and without the plugin, and hold at least one grader on the result (`file_exists`, `regex` or `llm`) and one on the steps (`tool_used` or `tool_order`). A case of an orchestrator SHALL carry the tag `orchestrator` and is run with `--ablation none`; it SHALL hold `tool_order` graders for the order of its blocks and `file_exists` graders for the files the run writes. Every case SHALL carry exactly one of the tags `block`, `orchestrator` or `sample`.

#### Scenario: Block case graders

- **WHEN** a case tagged `block` is loaded
- **THEN** it has a grader of type `file_exists`, `regex` or `llm`, and a grader of type `tool_used` or `tool_order`

#### Scenario: Orchestrators run one arm

- **WHEN** a contributor runs the orchestrator cases as the eval README says
- **THEN** the command filters on the tag `orchestrator` and passes `--ablation none`

### Requirement: Sample case reports the plugin's difference

The suite SHALL hold the case `sample-handover-note`, tagged `sample`, that measures a skill of a plugin kept inside the case directory and never released, builds its workspace from a shared fixture, and uses `file_exists`, `regex`, `tool_order`, `llm` and `tool_used` graders. Run with and without its plugin, the case SHALL report a with-arm score above the without-arm score.

#### Scenario: Difference is reported

- **WHEN** `pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*'` runs with credentials
- **THEN** the summary shows `WITH`, `W/OUT` and a positive `Δ` for `sample-handover-note`

### Requirement: Local run

`pnpm --filter @bdk/bdk run eval` SHALL build the plugin and run its suite with the Claude Code version pinned in the root `devDependencies`, running case scaffolds, and SHALL pass further arguments to `claude plugin eval`. `plugins/bdk/evals/README.md` SHALL say how to run the suite, how to probe cheaply, how to grant tools, how to write a block case, an orchestrator case and a shared fixture, and the host limits a case author meets.

#### Scenario: Arguments pass through

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval --case 'sample-*' --runs 1`
- **THEN** only `sample-handover-note` runs, once per arm

### Requirement: Offline gh stand-in

The suite SHALL ship an executable `plugins/bdk/evals/fixtures/bin/gh` that stands in for the GitHub CLI in eval runs, which have their own `HOME` and no GitHub credential. It SHALL answer `gh issue view <ref>` from the file `.git/bdk-eval/issues/<n>.json` of the git repository around the working directory, where `<n>` is the issue number of `<ref>` (`<n>`, `#<n>`, `<owner>/<repo>#<n>` or an issue URL), and SHALL accept `--repo`. With `--json <fields>` it SHALL print one JSON object holding only those fields; without it, the title, state and body as text. For an issue with no file it SHALL exit 1 with the message `GraphQL: Could not resolve to an issue or pull request with the number of <n>.`

It SHALL also answer pull requests from the directory `.git/bdk-eval/prs/`:

- `gh pr create --base <base> --head <head> --title <title> (--body <text> | --body-file <path>)` SHALL write the next file `<n>.json` (numbers from 1) holding `number`, `url` (`https://github.com/bdk-eval/repo/pull/<n>`), `state` `OPEN`, `baseRefName`, `headRefName`, `title` and `body`, and print the URL. A missing `--base`, `--head` or `--title`, a body file that cannot be read, or an open pull request with the same head SHALL exit 1 with a message.
- `gh pr view <head> [--json <fields>]` SHALL print the open pull request whose `headRefName` is `<head>` (as for issues, only the fields asked with `--json`), and SHALL exit 1 with `no pull requests found for branch "<head>"` when there is none.

Every other command SHALL exit 1 naming the stand-in, and it SHALL never reach the network. A case that uses the stand-in SHALL, from its scaffold, write its issue files and copy the stand-in to `.git/bdk-eval/bin/gh` of the workspace, because a run cannot execute a file outside its workspace; `plugins/bdk/evals/README.md` SHALL show the run command that puts the relative directory `.git/bdk-eval/bin` first on `PATH`.

#### Scenario: Issue from the scaffold

- **WHEN** a scaffold has written `.git/bdk-eval/issues/42.json` and `gh issue view '#42' --json number,title` runs the stand-in in the workspace
- **THEN** stdout is a JSON object with exactly the keys `number` and `title` from that file, and the exit code is 0

#### Scenario: Unknown issue

- **WHEN** `gh issue view 7` runs in a workspace with no `.git/bdk-eval/issues/7.json`
- **THEN** the exit code is 1 and stderr says `GraphQL: Could not resolve to an issue or pull request with the number of 7.`

#### Scenario: Pull request recorded

- **WHEN** `gh pr create --base main --head add-total --title "feat: tally total" --body-file body.md` runs the stand-in in a workspace without pull requests
- **THEN** `.git/bdk-eval/prs/1.json` holds `baseRefName` `main`, `headRefName` `add-total` and the body of `body.md`, stdout is `https://github.com/bdk-eval/repo/pull/1`, and the exit code is 0

#### Scenario: Pull request of a branch

- **WHEN** `gh pr view add-total --json url,state` runs after that pull request was created
- **THEN** stdout is a JSON object with exactly the keys `state` and `url`, and the exit code is 0

#### Scenario: No pull request for the branch

- **WHEN** `gh pr view add-total` runs in a workspace without pull requests
- **THEN** the exit code is 1 and stderr says `no pull requests found for branch "add-total"`

### Requirement: No paid evals in CI, free checks of the suite

No CI workflow SHALL start a paid eval run. PR CI SHALL load every case of `plugins/bdk/evals/` with the pinned Claude Code loader at a cost ceiling of zero and fail on a case that does not load or a grader that cannot pass with the tools the README grants, and SHALL run every shared fixture and every case scaffold as the harness runs them and fail on a non-zero exit. The check SHALL prove that it detects a broken case, so a change in the loader's output cannot turn it into a silent pass.

#### Scenario: Broken case fails CI

- **WHEN** a case under `plugins/bdk/evals/` has an unknown frontmatter key and `pnpm test` runs
- **THEN** the eval suite test fails and names the case

#### Scenario: Broken fixture fails CI

- **WHEN** a shared fixture or a case scaffold exits non-zero and `pnpm test` runs
- **THEN** the eval suite test fails and names the script

#### Scenario: No credentials needed

- **WHEN** the check runs with an empty `HOME` and no model credentials
- **THEN** it completes without a model call and without cost

### Requirement: B1-sized fixture

The suite SHALL ship a shared fixture of a Change the size of B1, in two states, each a script under `plugins/bdk/evals/fixtures/`:

- `household-book.sh` SHALL build a configured BDK project (`.bdk/settings.yaml` with a test and an e2e tool, `openspec/` with the BDK schema copied from the plugin, a main spec of the product, the product's code with passing tests) holding one active Change, `add-household-book`, with a proposal, spec deltas and a design, and with the design approval records under `.bdk/runs/add-household-book/design/`: the last report `verify-N.md` reading `Verdict: PASS`, and `gate.md` reading `Gate: approved` with a `Report:` line naming that report. It SHALL hold no plan part.
- `household-book-planned.sh` SHALL build the same project by running `household-book.sh` and adding the Change's plan parts and `.bdk/runs/add-household-book/plan/verify-1.md` reading `Verdict: PASS`, in one more commit.

The plan of the planned state SHALL have 7 parts, 27 tasks and 62 distinct files, SHALL pass `bdk plan check` with the default part limits, SHALL have at most 3 waves, and SHALL name every scenario of the Change's spec deltas in the acceptance scenarios of exactly one part. `plugins/bdk/evals/README.md` SHALL describe both states and how to start a run by hand at plan, at execute and at plan-to-PR.

#### Scenario: Ready to plan

- **WHEN** `household-book.sh` runs in an empty directory
- **THEN** `openspec/changes/add-household-book/` holds `proposal.md`, `design.md` and spec deltas but no `plan/`, the design gate reads `Gate: approved`, and `npm test` exits 0

#### Scenario: Planned state passes the plan check

- **WHEN** `household-book-planned.sh` runs in an empty directory and `bdk plan check openspec/changes/add-household-book/plan/parts` runs there
- **THEN** it exits 0 and reports 7 parts and 3 waves, the parts hold 27 tasks and list 62 distinct files, and every scenario of the spec deltas is named by exactly one part
