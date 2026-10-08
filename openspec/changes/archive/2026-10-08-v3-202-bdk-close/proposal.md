## Why

Tracks #202.

A BDK Change ends with nothing: the reviewed code sits on a branch, the spec deltas are not merged into the living documentation, and no pull request exists. The architecture (`docs/design/2026-10-07-v3-architecture.md`, "Catalog", "Autopilot", row 9 of "Autopilot continuation") names `/bdk:close` as the orchestrator that ends a Change: it composes `spec-conformance` (#196), `openspec archive`, `commit` (#206) and a pull request into the base branch the run started on, with no stacking ([D9](../../../docs/design/2026-10-07-v3-skills-decisions.md#d9-no-stacked-prs)). Draft 1 closed a Change through a kernel command and never checked the merged spec against the product (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "Living documentation"); `spec-conformance` now exists, and close is where it gates the archive.

## What Changes

- New skill `/bdk:close` (`plugins/bdk/skills/close/`), an orchestrator in the main thread: it checks the configuration and the Change, commits work left in the tree, starts `spec-conformance` on the `bdk:verifier` agent, archives the Change with `openspec archive`, commits the archive through the `commit` skill, pushes the branch and opens a pull request into the base branch, then writes `.bdk/runs/<change>/close/pr.md`, the file `bdk run status` reads as "PR opened".
- A failing spec-conformance report stops the close before the archive; close fixes neither the spec nor the code.
- Close resumes from its first missing step (row 9 of the resume table): an archived Change is not checked or archived again, and an open pull request of the branch is reused.
- No rebase, no force-push, no stacked branch (D9).
- The offline `gh` stand-in of the eval suite answers `gh pr create` and `gh pr view` from files under `.git/bdk-eval/`, so the close cases run without a GitHub credential.
- Orchestrator eval cases for a conforming Change (full close) and a contradicted one (stop before archive).

## Capabilities

### New Capabilities
- `bdk-close`: the `/bdk:close` orchestrator - its preconditions, the order of its blocks, the stop on a failing spec-conformance report, the archive and commit, the pull request into the base branch, the `close/pr.md` record, and resume.

### Modified Capabilities
- `skill-evals`: the offline `gh` stand-in also answers `gh pr create` and `gh pr view` for eval runs.

## Out of scope

- Fixing a failing spec-conformance item: the code side goes through `/bdk:execute` (#200) and `/bdk:auto-review` (#201), the spec side through `/bdk:design` (#198); routing a failed close inside a run is `/bdk:run` (#203).
- Queue order and Changes waiting on an unmerged blocker (D9): `/bdk:run` (#203).
- Creating the Change branch at the start of the work: the stage that starts the work; close only names a branch when it finds itself on the base branch.
- The spec-conformance check itself (#196) and the commit convention (#206).

## Impact

- `plugins/bdk/skills/close/SKILL.md` (new).
- `plugins/bdk/evals/fixtures/bin/gh`, `plugins/bdk/tests/evals.test.ts`: `pr create`, `pr view`.
- `plugins/bdk/evals/`: a shared fixture with a reviewed Change and a local bare remote, two orchestrator cases, the README paragraph that runs them.
- `CLAUDE.md` "Current state".
- No `bdk` CLI change: `bdk run status` already reads `close/spec-conformance.md`, the archive and `close/pr.md` (spec `bdk-cli/run`, row 9).
