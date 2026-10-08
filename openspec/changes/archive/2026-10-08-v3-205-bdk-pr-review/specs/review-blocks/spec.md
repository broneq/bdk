## ADDED Requirements

### Requirement: Review of another checkout and intent

`review-group`, `review-integration` and `judge` SHALL take three optional inputs, so that a caller can review code that is not the working directory's checkout:

- `--workdir <path>`: the checkout to review. The block SHALL read every file, the plan part and the Change under that path, run git as `git -C <path>`, and run `bdk` as `cd <path> && <bdk command>`; it SHALL still append to the log of the round directory it was given.
- `--change <path>`: the Change directory, relative to the work directory, archived or not (`openspec/changes/archive/<date>-<name>/`), used instead of `openspec/changes/<run directory name>/`. `--change none` SHALL mean the range carries no Change.
- `--intent <file>`: a file stating the intent of the reviewed range (a pull request's title, description and linked issues). The block SHALL read it as part of the contract, next to the Change when there is one, and in place of it when there is none.

Without these inputs a block SHALL behave as the Requirement "Round directory input" says.

#### Scenario: Pull request reviewed in its worktree

- **WHEN** `review-group` runs with the round `/p/.bdk/runs/pr-7/review/round-1`, group `p01`, `--workdir /p/.bdk/runs/pr-7/worktree`, `--change openspec/changes/monthly-report` and `--intent /p/.bdk/runs/pr-7/pr.md`
- **THEN** it reads `src/parse.js` and `openspec/changes/monthly-report/plan/parts/01.md` under the worktree, and appends its findings to `/p/.bdk/runs/pr-7/review/round-1/findings.jsonl`

#### Scenario: Range without a Change

- **WHEN** the judge runs with `--change none` and `--intent <brief>`
- **THEN** it sets the levels by the intent the brief states, and reads no `openspec/changes/` directory
