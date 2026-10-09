# Tasks

## 1. Launcher

- [x] 1.1 Write failing tests in `plugins/bdk/tests/evals.test.ts` for the launcher's pure helpers: the `PATH` filter drops every `node_modules/.bin` entry and keeps the rest in order (relative entries too), the `openspec` look-up warns for a missing one and for one under the home directory and stays quiet for one outside it; and that the `eval` script of `plugins/bdk/package.json` runs `evals/run.ts`. Verify: `pnpm vitest run plugins/bdk/tests/evals.test.ts` fails on them.
- [x] 1.2 Add `plugins/bdk/evals/run.ts` (design D2, D3), point the `eval` script at it and add it to `plugins/bdk/tsconfig.json`. Verify: the tests of 1.1 pass, `pnpm typecheck` and `pnpm lint` pass.

## 2. README

- [x] 2.1 In `plugins/bdk/evals/README.md`, say in "Run" what the script does with `PATH` and that cases calling `openspec` need a global OpenSpec 1.13.2 outside the home directory, and add the "Host limits" entry with the measured failure. Verify: `pnpm format:check` passes and the README's `propose-*` command reads correctly.

## 3. Acceptance and gates

- [x] 3.1 Run `propose-from-issue` with the README's command (real `HOME`, checkout under the home directory, Homebrew `openspec` 1.13.2) and confirm the run reaches `openspec new change` and scores as with a global `openspec` (before the fix: 0.22). Verify: the eval summary and the run's trace.
- [x] 3.2 Run `pnpm docs:reference`, every check CI runs (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec claude plugin validate .claude-plugin/marketplace.json --strict`, commitlint, the docs build), `openspec validate v3-300-eval-openspec-path --strict` and `openspec validate --specs --strict`. Verify: all exit 0.
