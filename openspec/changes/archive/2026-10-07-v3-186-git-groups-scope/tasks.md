# Tasks

Problem this CLI helper answers (`.claude/rules/bdk-cli.md`): run B1 reran full review rounds for one or two minor entries (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "Review reruns everything every round"), and grouping by hand costs the lead a turn per round with no reproducible result.

## 1. Dependencies and OS boundaries

- [x] 1.1 Add `zod` 4.6.5 and `yaml` 2.9.1 (exact) as dependencies of `plugins/bdk`; `pnpm install`
- [x] 1.2 Write the failing tests of `shared/fs` (readText, list, writeText, appendText against a temporary directory; `undefined` for a missing path)
- [x] 1.3 Implement `src/shared/fs/index.ts` with the API agreed with #179 and #188; admit it in `src/slices.ts` as `os-boundary`
- [x] 1.4 Write the failing tests of `shared/git` (stdout of a command in a temporary repository, `GitError` with stderr on failure, `env/git-missing` when the executable is missing)
- [x] 1.5 Implement `src/shared/git/index.ts`; admit it in `src/slices.ts` as `os-boundary`

## 2. Domain rules

- [x] 2.1 Write the failing tests of module packing: module of a path, small modules packed, a module up to the tolerance whole, cut by sub-directory, flat directory cut into even runs, sorted order
- [x] 2.2 Implement `domain/pack.ts`
- [x] 2.3 Write the failing tests of plan part parsing and part grouping: part ids from file names, first part wins, `unplanned`, a large part split with suffixes, no plan gives `m<k>`, `integration` last, no groups without text files, invalid frontmatter errors
- [x] 2.4 Implement `domain/plan.ts` and `domain/groups.ts`
- [x] 2.5 Write the failing tests of the anchor choice and the round record: last finished round, crashed round ignored, missing or invalid record, head not an ancestor, `numstat` parsing into files and binary
- [x] 2.6 Implement `domain/range.ts`, `store/rounds.ts`, `store/plan.ts` and `use-cases/deps.ts`

## 3. Commands

- [x] 3.1 Write the failing use-case tests of `scope` and `groups` with a fake `Git` and an in-memory `Files` (every error code of "Errors of the git commands", `--record` writes only on success)
- [x] 3.2 Implement `schema/`, `use-cases/`, `render/`, `commands/` and `index.ts` (`gitGroup(deps)`) of the `git` slice; add the `git` row to `src/slices.ts`
- [x] 3.3 Write the failing end-to-end tests against temporary git repositories through `run` of the frame: every scenario of the spec `bdk-cli/git` that needs real git, JSON validated against the schemas, byte-identical output on a second run
- [x] 3.4 Wire the slice in `src/main.ts` with `{ git, files, cwd }`

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: build the CLI, run `bin/bdk git groups` twice on the same repository state (this repository against `origin/staging/v3`) and compare the outputs byte for byte; run `bin/bdk git scope` with a round record and a fix commit in a temporary repository
- [x] 4.2 Run every check CI runs: `pnpm check` (lint, format:check, typecheck, test, build), `claude plugin validate` of the marketplace and every plugin, commitlint of the commit
- [x] 4.3 `openspec validate v3-186-git-groups-scope --strict` and `openspec validate --specs --strict`
