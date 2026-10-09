## 1. Fixture run

- [x] 1.1 Record one `/bdk:debug` run of the tally crash (the `debug-fix` scaffold) with `claude -p --plugin-dir plugins/bdk` in a separate test project; copy its transcripts and `.bdk/runs/fix-total-crash/` into `plugins/bdk/evals/fixtures/diagnose-run/`, trimmed of tool output and thinking text, and write `fixtures/diagnose-run.sh` that builds the project after the run with the transcripts in `.git/bdk-eval/transcripts/`
- [x] 1.2 Write down the ground truth of the fixture (stages, agents, tokens, host cost, waste) from an independent count, for the graders

## 2. Plain skill and its eval (/skill-creator)

- [x] 2.1 Eval cases `diagnose-run-fixture` (the recorded run) and `diagnose-run-missing-transcript` (one subagent transcript removed), graded on the report file, its stage order, numbers from the ground truth, citations that resolve, the missing agent, and that `bdk:analyst` ran
- [x] 2.2 Agent `bdk:analyst` and the plain skill `diagnose-run` (no CLI helper), and the `models.analyst` role
- [x] 2.3 Run the plain skill on both cases; record the result and the problem it shows in design.md "Measurement"

## 3. `bdk diagnostics report` (for the problem 2.3 recorded)

- [x] 3.1 Failing unit tests of the transcript parser, the session build (stages, agent tree, cost share, missing transcripts), the detectors and the transcript location
- [x] 3.2 The slice `src/diagnostics/` (domain, store, use case, schema, render, command), its row in `src/slices.ts` and its group in `src/main.ts`
- [x] 3.3 A built-CLI test on the fixture: the stage order, the agents, the host cost, a citation that resolves, and the missing-transcript case

## 4. Skill on the CLI

- [x] 4.1 Rewrite `diagnose-run` (/skill-creator) to take the numbers from `bdk diagnostics report` and read only the run files itself
- [x] 4.2 Run both eval cases again; record the result in design.md "Measurement" and the eval README

## 5. Docs

- [x] 5.1 `docs/guide/diagnostics.md` (new, in the Guide sidebar), `docs/concepts/agents.md` (`bdk:analyst`), `docs/concepts/cli-config-hooks.md` (`bdk diagnostics report`), `docs/guide/footprint.md` and `docs/guide/index.md` (links), `plugins/bdk/skills/cli/SKILL.md` (`/bdk:cli` names every command), `plugins/bdk/evals/README.md` (the cases and how the fixture was recorded)
- [x] 5.2 `pnpm docs:reference`

## 6. Gates

- [x] 6.1 `pnpm check`, every job of `.github/workflows/pr.yml`, `openspec validate --specs --strict`
