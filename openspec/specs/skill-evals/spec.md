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

A case of a block SHALL carry the tag `block`, run with and without the plugin, and hold at least one grader on the result (`file_exists`, `regex` or `llm`) and one on the steps (`tool_used` or `tool_order`). A case of an orchestrator SHALL carry the tag `orchestrator` and is run with `--ablation none`; it SHALL hold `tool_order` graders for the order of its blocks and `file_exists` graders for the files the run writes. An orchestrator case whose correct run writes no file SHALL also carry the tag `writes-nothing`; it SHALL then hold no `file_exists` grader and at least one `regex` grader with `target: trace`. Every case SHALL carry exactly one of the tags `block`, `orchestrator` or `sample`.

#### Scenario: Block case graders

- **WHEN** a case tagged `block` is loaded
- **THEN** it has a grader of type `file_exists`, `regex` or `llm`, and a grader of type `tool_used` or `tool_order`

#### Scenario: Orchestrator case graders

- **WHEN** a case tagged `orchestrator` and not `writes-nothing` is loaded
- **THEN** it has a grader of type `tool_order` and a grader of type `file_exists`

#### Scenario: Orchestrator case that writes nothing

- **WHEN** a case tagged `orchestrator` and `writes-nothing` is loaded
- **THEN** it has a grader of type `tool_order`, a `regex` grader with `target: trace`, and no grader of type `file_exists`

#### Scenario: Orchestrators run one arm

- **WHEN** a contributor runs the orchestrator cases as the eval README says
- **THEN** the command filters on the tag `orchestrator` and passes `--ablation none`

### Requirement: Sample case reports the plugin's difference

The suite SHALL hold the case `sample-handover-note`, tagged `sample`, that measures a skill of a plugin kept inside the case directory and never released, builds its workspace from a shared fixture, and uses `file_exists`, `regex`, `tool_order`, `llm` and `tool_used` graders. Run with and without its plugin, the case SHALL report a with-arm score above the without-arm score.

#### Scenario: Difference is reported

- **WHEN** `pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*'` runs with credentials
- **THEN** the summary shows `WITH`, `W/OUT` and a positive `Δ` for `sample-handover-note`

### Requirement: Local run

`pnpm --filter @bdk/bdk run eval` SHALL build the plugin and run its suite with the Claude Code version pinned in the root `devDependencies`, running case scaffolds, and SHALL pass further arguments to `claude plugin eval`. The run SHALL inherit the caller's `PATH` without any `node_modules/.bin` directory, so a command a case calls by name, such as `openspec`, resolves to an install outside the workspace and not to a pnpm shim whose package the run's sandbox cannot read. When `CLAUDE_CODE_SHELL_PREFIX` names an absolute path, the directory of that file SHALL come first on the `PATH` the run inherits, so the run's sandbox, which reads under `/Users` only the directories on `PATH`, can run the prefix. Before the run starts, the command SHALL print a warning naming `openspec` when that `PATH` holds no `openspec`, or holds one whose real path lies under the home directory, and SHALL start the run either way. `plugins/bdk/evals/README.md` SHALL say how to run the suite, how to probe cheaply, how to grant tools, how to write a block case, an orchestrator case and a shared fixture, which global OpenSpec the cases that call `openspec` need, and the host limits a case author meets.

#### Scenario: Arguments pass through

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval --case 'sample-*' --runs 1`
- **THEN** only `sample-handover-note` runs, once per arm

#### Scenario: No workspace bin directory reaches the run

- **WHEN** a contributor runs `pnpm --filter @bdk/bdk run eval` and pnpm has put `plugins/bdk/node_modules/.bin` and `node_modules/.bin` first on `PATH`
- **THEN** the `PATH` that `claude plugin eval` and its runs inherit holds neither directory, and keeps every other entry in its order

#### Scenario: The shell prefix is readable in a run

- **WHEN** a contributor on a Mac without Homebrew git runs the README's `execute-*` command with `CLAUDE_CODE_SHELL_PREFIX` set to the prefix the "Host limits" `git` entry installs
- **THEN** the prefix's directory is the first entry of the run's `PATH`, the skill's `bdk config show` block runs, and `/bdk:execute` starts its `bdk:lead` agent

#### Scenario: OpenSpec cases reach OpenSpec

- **WHEN** a contributor with a global OpenSpec 1.13.2 outside the home directory runs `propose-from-issue` with the README's command from a checkout under the home directory
- **THEN** the run calls `openspec new change` successfully and scores as it does when the workspace OpenSpec is not installed

#### Scenario: No readable OpenSpec is warned about

- **WHEN** the `PATH` left after removing the `node_modules/.bin` directories holds no `openspec`, or one whose real path lies under the home directory
- **THEN** the command prints a warning naming `openspec` and the README section to read, and the run still starts

### Requirement: Offline gh stand-in

The suite SHALL ship an executable `plugins/bdk/evals/fixtures/bin/gh` that stands in for the GitHub CLI in eval runs, which have their own `HOME` and no GitHub credential. It SHALL answer `gh issue view <ref>` from the file `.git/bdk-eval/issues/<n>.json` of the git repository around the working directory, where `<n>` is the issue number of `<ref>` (`<n>`, `#<n>`, `<owner>/<repo>#<n>` or an issue URL), and SHALL accept `--repo`. With `--json <fields>` it SHALL print one JSON object holding only those fields; without it, the title, state and body as text. For an issue with no file it SHALL exit 1 with the message `GraphQL: Could not resolve to an issue or pull request with the number of <n>.`

It SHALL also answer pull requests from the directory `.git/bdk-eval/prs/`:

- `gh pr create --base <base> --head <head> --title <title> (--body <text> | --body-file <path>)` SHALL write the next file `<n>.json` (numbers from 1) holding `number`, `url` (`https://github.com/bdk-eval/repo/pull/<n>`), `state` `OPEN`, `baseRefName`, `headRefName`, `title` and `body`, and print the URL. A missing `--base`, `--head` or `--title`, a body file that cannot be read, or an open pull request with the same head SHALL exit 1 with a message.
- `gh pr view <head> [--json <fields>]` SHALL print the open pull request whose `headRefName` is `<head>` (as for issues, only the fields asked with `--json`), and SHALL exit 1 with `no pull requests found for branch "<head>"` when there is none.
- `gh pr view <n> | <pr-url> [--json <fields>]` SHALL print the pull request of the file `<n>.json`, whatever its state, and SHALL exit 1 with `GraphQL: Could not resolve to a PullRequest with the number of <n>.` when there is none. Fields a scaffold wrote (`isDraft`, `author`, `headRefOid`, `closingIssuesReferences` and others) SHALL be printed as written.
- `gh repo view [--json <fields>]` SHALL print the repository `bdk-eval/repo` (`nameWithOwner`, `url` `https://github.com/bdk-eval/repo`, `defaultBranchRef` `{"name": "main"}`).
- `gh api user` SHALL print `{"login": "bdk-eval-user"}`.
- `gh api repos/<owner>/<repo>/pulls/<n>/reviews -X POST --input <file>` (`--method POST` too) SHALL, for an existing pull request `<n>`, copy the JSON of `<file>` to the next file `.git/bdk-eval/reviews/<n>-<k>.json` (`k` from 1) and print `{"id": <k>, "html_url": "https://github.com/bdk-eval/repo/pull/<n>#pullrequestreview-<k>", "state": <state of the event>}`. Input that is not JSON, or has no `event` or no `body`, SHALL exit 1 with a message holding `HTTP 422`, as gh does, and a pull request without a file SHALL exit 1 with a message holding `HTTP 404`.
- `gh api graphql -f query=<query> [-f|-F <name>=<value>]...` SHALL, for a query naming `reviewThreads`, print `{"data":{"repository":{"pullRequest":{...}}}}` for the pull request of the variable `pr` (or `number`), holding `reviews.nodes` (one per recorded review `<n>-<k>.json`: `id`, `body`, `state`, `url`, `author.login` `bdk-eval-user`, `commit.oid`) and `reviewThreads.nodes` (one per inline comment of each recorded review, in order: `id` `PRRT_<n>_<k>_<i>`, `isResolved`, `isOutdated` false, `path`, `line`, `originalLine`, and `comments.nodes` with that comment's `body`, `url` and `author.login`). For a mutation naming `resolveReviewThread` it SHALL add the thread of the variable `t` (or `threadId`) to the list `.git/bdk-eval/resolved.json` and print `{"data":{"resolveReviewThread":{"thread":{"isResolved":true}}}}`; an unknown thread SHALL exit 1. Any other query SHALL exit 1 naming the stand-in.

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

#### Scenario: Pull request by number

- **WHEN** a scaffold has written `.git/bdk-eval/prs/7.json` with `headRefOid` and `gh pr view https://github.com/bdk-eval/repo/pull/7 --json number,headRefOid` runs the stand-in
- **THEN** stdout is a JSON object with exactly the keys `headRefOid` and `number` from that file, and the exit code is 0

#### Scenario: Review recorded

- **WHEN** `gh api repos/bdk-eval/repo/pulls/7/reviews -X POST --input review.json` runs with a `review.json` holding `event` `REQUEST_CHANGES` and a `body`
- **THEN** `.git/bdk-eval/reviews/7-1.json` holds the JSON of `review.json`, stdout names the review id 1 and the state `CHANGES_REQUESTED`, and the exit code is 0

#### Scenario: Review threads of recorded reviews

- **WHEN** review `7-1.json` with two inline comments was recorded and `gh api graphql -f query=<a reviewThreads query> -F owner=bdk-eval -F repo=repo -F pr=7` runs the stand-in
- **THEN** stdout holds one review node with the review's body and two unresolved thread nodes `PRRT_7_1_1` and `PRRT_7_1_2` with the comments' paths, lines and bodies

#### Scenario: Thread resolved

- **WHEN** `gh api graphql -f query=<a resolveReviewThread mutation> -F t=PRRT_7_1_1` runs after that
- **THEN** `.git/bdk-eval/resolved.json` lists `PRRT_7_1_1`, and the next reviewThreads query shows that thread with `isResolved` true and the other unresolved

### Requirement: No paid evals in CI, free checks of the suite

No CI workflow SHALL start a paid eval run. PR CI SHALL find every `plugins/<name>/evals/` that holds a case and, for each, load every case with the pinned Claude Code loader at a cost ceiling of zero and with the tools that plugin's eval README grants, and fail on a case that does not load or a grader that cannot pass with those tools. It SHALL run every case scaffold of every such suite and every shared fixture of `plugins/bdk/evals/fixtures/` as the harness runs them, and fail on a missing script or a non-zero exit. A suite whose plugin has no grants listed for the check SHALL fail it. The check SHALL prove that it detects a broken case, so a change in the loader's output cannot turn it into a silent pass.

#### Scenario: Broken case fails CI

- **WHEN** a case under `plugins/bdk/evals/` has an unknown frontmatter key and `pnpm test` runs
- **THEN** the eval suite test fails and names the case

#### Scenario: Broken case of another plugin fails CI

- **WHEN** the `case.yaml` of `plugins/bdk-skill-kit/evals/skill-check-internal-error` is not valid YAML, or names a `scaffold_script` that does not exist, and `pnpm check` runs
- **THEN** it fails and names the plugin and the case

#### Scenario: Every plugin's cases load

- **WHEN** `pnpm test` runs on a tree where `plugins/bdk/evals/`, `plugins/bdk-craft/evals/` and `plugins/bdk-skill-kit/evals/` hold cases
- **THEN** the loader check runs once for each of the three suites and every case loads

#### Scenario: New suite without grants

- **WHEN** a plugin gains its first eval case and the check lists no grants for that plugin
- **THEN** the eval suite test fails and names the plugin

#### Scenario: Broken fixture fails CI

- **WHEN** a shared fixture or a case scaffold exits non-zero and `pnpm test` runs
- **THEN** the eval suite test fails and names the script

#### Scenario: No credentials needed

- **WHEN** the check runs with an empty `HOME` and no model credentials
- **THEN** it completes without a model call and without cost

### Requirement: B1-sized fixture

The suite SHALL ship a shared fixture of a Change the size of B1, in three states, each a script under `plugins/bdk/evals/fixtures/`:

- `household-book.sh` SHALL build a configured BDK project (`.bdk/settings.yaml` with a test and an e2e tool, `openspec/` with the BDK schema copied from the plugin, a main spec of the product, the product's code with passing tests) holding one active Change, `add-household-book`, with a proposal, spec deltas and a design, and with the design approval records under `.bdk/runs/add-household-book/design/`: the last report `verify-N.md` reading `Verdict: PASS`, and `gate.md` reading `Gate: approved` with a `Report:` line naming that report. It SHALL hold no plan part.
- `household-book-planned.sh` SHALL build the same project by running `household-book.sh` and adding the Change's plan parts and `.bdk/runs/add-household-book/plan/verify-1.md` reading `Verdict: PASS`, in one more commit.
- `household-book-queued.sh` SHALL build the planned state by running `household-book-planned.sh` and make it ready for an unattended plan-to-PR run by `/bdk:run` without arguments, adding no commit: a bare repository inside the workspace as `origin` holding `main`, with `origin/HEAD` set; the offline `gh` stand-in at `.git/bdk-eval/bin/gh`; `.bdk/runs/run.json` queueing `add-household-book` from an intent, in `non-interactive` mode with base `main`; and `.bdk/settings.local.yaml` setting both gates to `auto`, `policy.questions` to `decide-and-record` and `execution.lead` to `foreground`.

The plan of the planned state SHALL have 7 parts, 27 tasks and 62 distinct files, SHALL pass `bdk plan check` with the default part limits, SHALL have at most 3 waves, and SHALL name every scenario of the Change's spec deltas in the acceptance scenarios of exactly one part. `plugins/bdk/evals/README.md` SHALL describe the three states and how to start a run by hand at plan, at execute and at plan-to-PR.

#### Scenario: Ready to plan

- **WHEN** `household-book.sh` runs in an empty directory
- **THEN** `openspec/changes/add-household-book/` holds `proposal.md`, `design.md` and spec deltas but no `plan/`, the design gate reads `Gate: approved`, and `npm test` exits 0

#### Scenario: Planned state passes the plan check

- **WHEN** `household-book-planned.sh` runs in an empty directory and `bdk plan check openspec/changes/add-household-book/plan/parts` runs there
- **THEN** it exits 0 and reports 7 parts and 3 waves, the parts hold 27 tasks and list 62 distinct files, and every scenario of the spec deltas is named by exactly one part

#### Scenario: Queued state is at execute with a clean tree

- **WHEN** `household-book-queued.sh` runs in an empty directory and `bdk run status --json` runs there
- **THEN** it exits 0, the entry of `add-household-book` reads stage `execute`, `git status --porcelain` prints nothing, `origin/main` is `main`'s commit, and the resolved configuration has `policy.gates.design` and `policy.gates.review` `auto`, `policy.questions` `decide-and-record` and `execution.lead` `foreground`

### Requirement: plan-draft measured on the B1-sized fixture

The suite SHALL hold the block case `plan-draft-household-book`, tagged `block`, whose scaffold builds the ready-to-plan state of the B1-sized fixture through `household-book.sh`, whose prompt asks for the implementation plan of `add-household-book` without naming the skill, and whose run limits leave room for a Change of that size (`max_turns` at least 150, `timeout_seconds` at least 1800). Its graders SHALL include a `file_exists` grader on the first plan part, a `regex` grader on the trace for a passing `bdk plan check` with at most three waves, and a `tool_used: Skill` grader for `plan-draft`. `plugins/bdk/evals/README.md` SHALL give the command that runs it with and without the plugin.

#### Scenario: Case loads with the README's grants

- **WHEN** the free check loads `plan-draft-household-book` with the grants `Write Edit`
- **THEN** the case loads, carries the tag `block`, and every grader can pass

#### Scenario: Scaffold builds the ready-to-plan state

- **WHEN** the case's scaffold runs in an empty workspace as the harness runs it
- **THEN** it exits 0 and `openspec/changes/add-household-book/` holds the proposal, the design and the spec deltas but no `plan/`

### Requirement: plan-draft design-gap case on the B1-sized fixture

The suite SHALL hold the block case `plan-draft-household-book-gap`, tagged `block`, whose scaffold builds the ready-to-plan state of the B1-sized fixture through `household-book.sh` and then opens exactly one product choice in the Change `add-household-book`: a recurring entry's day SHALL be accepted from 1 to 31, and neither the spec deltas nor the design SHALL say what a recurring entry does in a month that has no such day. Every other text of the Change and its design records SHALL stay as the fixture writes it, the Change SHALL keep its 71 scenarios, and the variant SHALL be committed so the working tree is clean. Its prompt SHALL ask for the implementation plan of `add-household-book` without naming the skill or the open choice. Its graders SHALL include an `llm` grader that passes only when the final reply names the short-month choice as open and left to the user, a `file_exists` grader on the first plan part, and a `tool_used: Skill` grader for `plan-draft`. `plugins/bdk/evals/README.md` SHALL give the command that runs it with and without the plugin.

#### Scenario: Case loads with the README's grants

- **WHEN** the free check loads `plan-draft-household-book-gap` with the grants `Write Edit`
- **THEN** the case loads, carries the tag `block`, and every grader can pass

#### Scenario: Scaffold opens the short-month choice

- **WHEN** the case's scaffold runs in an empty workspace as the harness runs it
- **THEN** it exits 0, the spec delta `ledger-recurring` accepts days 1 to 31, no file of the Change or of `.bdk/runs/add-household-book/` names the range 1 to 28 or how a short month is handled, the Change holds 71 scenarios and no `plan/`, and `git status --porcelain` prints only the ignored run records

#### Scenario: Everything else is the shared fixture

- **WHEN** the variant and `household-book.sh` are built side by side
- **THEN** every file of `openspec/changes/add-household-book/` other than the `ledger-recurring` spec delta and the design is identical in both

### Requirement: Execute cases run end to end

The `execute-*` orchestrator cases SHALL each start the `bdk:lead` agent and its workers when run with the command `plugins/bdk/evals/README.md` gives for them. That command SHALL grant `SendMessage` and `ToolSearch`, which `/bdk:execute` uses to continue its lead after a blocker and to load `AskUserQuestion`, besides the tools and Bash commands the lead and its workers call. The README SHALL record the score of every `execute-*` case from such a run, with its date and Claude Code version.

#### Scenario: The README command grants what the stage uses

- **WHEN** a contributor reads the README command of the `execute-*` cases
- **THEN** it grants `Write`, `Edit`, `SendMessage`, `ToolSearch` and the Bash commands `*/bin/bdk *`, `mkdir -p *`, `cd *` and `git *`

#### Scenario: Every execute case starts the lead

- **WHEN** a contributor runs every `execute-*` case once with the README command (and, on a Mac without Homebrew git, the `git` entry of "Host limits")
- **THEN** in each run `/bdk:execute` starts one `bdk:lead` agent that writes `.bdk/runs/add-totals/execute/result.md`, and `execute-single-part-wave`, `execute-resume-worktree` and `execute-resume-main-checkout` score 1.00

### Requirement: Plan stop cases

The suite SHALL hold two orchestrator cases of `/bdk:plan` for the paths that end without a verifier pass. `plan-design-gap` SHALL build the `ledger-change` fixture with one requirement added to the spec delta `ledger-export` that the design does not settle (`ledger export <file> --out <path>`, with no rule for an existing `<path>`), and SHALL grade that `plan-draft` runs, that no `bdk:verifier` agent starts and no plan report is written, that the first plan part exists, and that the reply names the gap and `/bdk:design add-csv-export`. `plan-passed` SHALL carry the tag `writes-nothing`, build the hand-written plan of `plan-verify-written` with a `.bdk/runs/add-csv-export/plan/verify-1.md` whose first line is `Verdict: PASS`, and SHALL grade that the skill reads that report and runs `bdk plan check`, that neither `plan-draft` nor a `bdk:planner` or `bdk:verifier` agent runs, that no `Write` or `Edit` call is made, and that the reply says the plan passed and names `/bdk:execute add-csv-export`. `plugins/bdk/evals/README.md` SHALL record the result of each case run with `--ablation none`.

#### Scenario: Gap stops the plan before the verifier

- **WHEN** `plan-design-gap` runs with `--ablation none` and the README's grants
- **THEN** it scores 1.00: a `bdk:planner` agent runs, no `bdk:verifier` agent starts, `plan/parts/01.md` exists, and the reply names the existing-file choice and `/bdk:design add-csv-export`

#### Scenario: Passed plan runs no block

- **WHEN** `plan-passed` runs with `--ablation none` and the README's grants
- **THEN** it scores 1.00: one `bdk plan check` runs, no block runs, no file is written, and the reply names `/bdk:execute add-csv-export`

#### Scenario: Scaffolds build clean workspaces

- **WHEN** the scaffolds of both cases run in an empty workspace as the harness runs them
- **THEN** each exits 0 and `git status --porcelain` prints nothing
