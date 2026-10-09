# Tasks

## 1. Launcher

- [x] 1.1 Write failing tests in `plugins/bdk/tests/evals.test.ts`: the run's `PATH` starts with the directory of an absolute `CLAUDE_CODE_SHELL_PREFIX`, without repeating an entry already there; an unset, empty or relative prefix leaves `PATH` as before; and the README command of the `execute-*` cases grants `SendMessage` and `ToolSearch`. Verify: `pnpm vitest run plugins/bdk/tests/evals.test.ts` fails on them.
- [x] 1.2 Extend `plugins/bdk/evals/run.ts` (design D2) and make `macos-git-prefix.sh` find its `git` copy in its own directory (D3). Verify: the tests of 1.1 pass, `pnpm typecheck` and `pnpm lint` pass.

## 2. README

- [x] 2.1 In `plugins/bdk/evals/README.md`, rewrite the `git` entry of "Host limits" with the measured cause (D1) and the new layout (D3), say in "PATH leaks from the caller" that a Claude Code session may refuse nested runs, and add `SendMessage ToolSearch` to the `execute-*` command (D4). Verify: `pnpm format:check` passes.

## 3. Acceptance and gates

- [x] 3.1 Install the prefix as the new entry says and run every `execute-*` case once with the README command from a plain terminal. Read each run's trace: the lead and its workers start. Any case below 1.00 is read to its cause; a skill defect is fixed through `/skill-creator` with its eval case, or filed as its own issue when out of scope. Record the scores in the README (D5). Verify: the eval summary; `execute-single-part-wave`, `execute-resume-worktree` and `execute-resume-main-checkout` score 1.00.
- [x] 3.2 Run `pnpm docs:reference`, every check CI runs (`.github/workflows/`), `openspec validate v3-313-execute-evals-lead --strict` and `openspec validate --specs --strict`. Verify: all exit 0.
