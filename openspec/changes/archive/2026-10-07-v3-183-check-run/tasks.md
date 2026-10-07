# Tasks

Problem this CLI helper answers (`.claude/rules/bdk-cli.md`): run B1 spent 46 haiku runner runs of about 1.1 min and 670 k cache-read tokens each to run `vitest` and `eslint`, parallel tasks shared one check file, and commands hung on stdin past their timeout (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "Agents for work that takes seconds", "Parallel tasks share one tree and one check file", "Commands hang on stdin").

## 1. Frame and configuration

- [x] 1.1 Write the failing frame tests: a repeatable string flag passes its values in order, byte for byte (`a b.ts`); command help marks it `(repeatable)`
- [x] 1.2 Implement `multiple` on `Flag` in `src/shared/cli/` (`types.ts`, `run.ts`, `help.ts`)
- [x] 1.3 Write the failing config tests: `tools.test.unit.timeout` accepted as an integer of at least 1, `timeout: 0` reported as a problem
- [x] 1.4 Add `timeout` to the `Check` item of `src/config/domain/settings.ts`

## 2. Shell boundary

- [x] 2.1 Write the failing tests of `shared/shell` against `/bin/sh`: output of both streams in one file followed by `exit <code>`; stdin at end of file; timeout kills the shell and a child it started (`timeout <s>` line); signal exit as 128 plus the signal number
- [x] 2.2 Implement `src/shared/shell/index.ts`; admit it in `src/slices.ts` as `os-boundary`

## 3. The check slice

- [x] 3.1 Write the failing domain tests: entry selection and order by kind, `{files}` filled with deduplicated sorted paths, shell quoting, full command when no `scoped`, status and verdict, tail of 20 lines without the exit line, finding fields
- [x] 3.2 Implement `domain/plan.ts` and `domain/verdict.ts`
- [x] 3.3 Write the failing use-case tests with an in-memory `Files` and a fake shell: every error of "Errors of the check command" before any command runs, result and output paths, earlier result replaced, `--round` appends one finding per red check with a stable id, nothing appended when green, verdict `none`
- [x] 3.4 Implement `store/results.ts`, `schema/run.ts`, `use-cases/run.ts`, `render/run.ts`, `commands/run.ts` and `index.ts` (`checkGroup(deps)`); add the `check` row to `src/slices.ts` (imports `config`, `findings`)
- [x] 3.5 Write the failing end-to-end tests through `run` of the frame against a temporary project with real `/bin/sh`: scoped run, red check with exit 1, timeout, `--json` byte-identical to the result file and valid against the schema, text output
- [x] 3.6 Wire the slice in `src/main.ts` with `{ files, cwd, home, env, shell }`; update `CLAUDE.md` "Current state"

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: build the CLI and run `bin/bdk check run <run-dir> 01 --scope <file>` in a temporary configured project; confirm `checks/01.json` holds per-command status and output path and the output files exist
- [x] 4.2 Run every check CI runs (`.github/workflows/`): `pnpm check` and the other jobs
- [x] 4.3 `openspec validate v3-183-check-run --strict` and `openspec validate --specs --strict`
