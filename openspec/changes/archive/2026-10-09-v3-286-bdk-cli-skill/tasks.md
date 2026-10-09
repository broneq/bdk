# Tasks

## 1. Evals first

- [x] 1.1 Write the cases `cli-config`, `cli-run-state`, `cli-findings`, `cli-route` under `plugins/bdk/evals/` on the fixtures `monthly-report-judged.sh` and `tally-queue.sh`; verify the loader check passes with `pnpm vitest run plugins/bdk/tests/evals.test.ts`
- [x] 1.2 Write the drift test `scripts/cli-skill.test.ts` (spec "The skill follows the CLI"); verify it fails because the skill does not exist

## 2. The skill

- [x] 2.1 Write `plugins/bdk/skills/cli/SKILL.md` with `/skill-creator`, at most 30 lines, per design D1 to D3; verify the drift test passes and `skill-check` reports no finding
- [x] 2.2 Probe the cases with `--runs 1`, then run them with and without the plugin, 3 runs; record `WITH`, `W/OUT` and `Δ` in the PR body and fix the skill for any loss

## 3. Docs

- [x] 3.1 Update `docs/concepts/cli-config-hooks.md` and the Guide page that lists the skills to name `/bdk:cli`; add the eval run line to `plugins/bdk/evals/README.md`
- [x] 3.2 Run `pnpm docs:reference`; verify the Reference is regenerated

## 4. Acceptance and gates

- [x] 4.1 End to end in a separate test project started with `claude --plugin-dir plugins/bdk`: ask the four questions of the cases; verify the answers
- [x] 4.2 Run every check CI runs (`.github/workflows/`), `openspec validate v3-286-bdk-cli-skill --strict` and `openspec validate --specs --strict`; verify each passes
