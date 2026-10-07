# Proposal

## Why

Tracks #186.

A review round needs two answers before any reviewer starts: which commits it covers, and which files each reviewer gets. Draft 1 measured what happens when the first answer is missing: "Review reruns everything every round. 4 rounds, 55 agents; rounds 3 and 4 held 2 and 1 minor entries and still ran a gate runner, an integration reviewer and group reviewers" (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`). The v3 architecture answers it in "Review round" (a later round covers only the scope of the fixes) and lists `bdk git groups`, `scope` in its "CLI" table. Grouping by hand costs the lead a model turn of `git diff` reading per round, and two runs of the same lead split the same files differently; a deterministic command saves that turn and makes the split reproducible.

## What Changes

- New command group `bdk git`, the first product slice of the `bdk` CLI (`plugins/bdk/src/git/`):
  - `bdk git scope <base> [--rounds <dir>]` - the range a review round covers: from the merge base of `HEAD` and `<base>`, or from the commit the last finished round recorded; the changed text files, binary files, deleted files and tracked files with uncommitted changes.
  - `bdk git groups <base> [--rounds <dir>] [--plan <dir>] [--max-files <n>] [--record <round-dir>]` - the same scope split into reviewer groups: one per plan part, then by module, sized by a file target, and a last `integration` group of all changed text files. `--record` saves the result as `<round-dir>/groups.json`, the record a later round reads.
- How the last round's commit is recorded (issue, "To resolve in the spec"): the `head` of `review/round-N/groups.json`, written by `bdk git groups --record`; a round counts as finished when its directory holds `report.md`. Details in design.md (D3).
- New OS boundaries in `plugins/bdk/src/shared/`: `git` (runs `git`), and `fs` (file reads and writes, API agreed with #179 and #188, which ship the same module).
- New runtime dependencies of `plugins/bdk`: `zod` (output schemas, `bdk-cli` design D7 of v3-178) and `yaml` (plan part frontmatter), the versions #179 pins.

## Capabilities

### New Capabilities

- `bdk-cli/git`: the `bdk git` command group - `scope` and `groups`, the round record, the grouping rules and their errors.

### Modified Capabilities

None. The frame (`bdk-cli`) is used as specified; the slice adds its own `env/*` and `usage/*` codes, which `bdk-cli` "Errors" allows.

## Impact

- Code: `plugins/bdk/src/git/` (new slice), `plugins/bdk/src/shared/git/`, `plugins/bdk/src/shared/fs/`, `plugins/bdk/src/slices.ts`, `plugins/bdk/src/main.ts` (wires the slice with its OS boundaries), `plugins/bdk/build.ts` (a `require` banner for CommonJS dependencies), `CLAUDE.md` "Current state".
- Dependencies: `plugins/bdk/package.json`, `pnpm-lock.yaml`.
- Tests: unit tests in the slice and the boundaries, against temporary git repositories for the git boundary and the use cases' end-to-end behaviour.
- Callers: the review-round lead and `/bdk:pr-review` (architecture "Catalog") call these commands; neither exists yet, so nothing calls them in this Change.
- Out of scope: the review skills themselves (the review issues of the milestone), `bdk findings` (#187), `bdk run status` (#188), the plan part format (#180, which owns the frontmatter this command reads), configuration (#179: when `bdk config` exists, the lead passes a configured file target to `--max-files`).
