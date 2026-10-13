## 1. CLI: bdk check plan

- [x] 1.1 Write failing tests in `plugins/bdk/src/check/tests/` for the plan use case: selection unchanged from `check run` (points, kinds, run files, `paths`, `{files}`, quoting, skips), `--tests` routed to `tools.test` items only and the run's files to lint and build items, the line `<command> </dev/null > <output> 2>&1` with the output path relative to the project root, the Bash timeout capped by an injected `BASH_MAX_TIMEOUT_MS` with its note, the compound-command note, `plan.json` written, nothing run (the scenarios of "Plan the checks")
- [x] 1.2 Implement `domain/plan.ts` changes (test files per kind, line, Bash timeout, notes), `use-cases/plan.ts`, `schema/plan.ts`, `store` paths for `plan.json`, `render/plan.ts` and `commands/plan.ts`; inject `BASH_MAX_TIMEOUT_MS` from `src/main.ts`
- [x] 1.3 Write failing tests for the plan text output and the plan errors (`usage/invalid-argument` for an empty `--tests`, the existing errors)

## 2. CLI: bdk check record

- [x] 2.1 Write failing tests for the record use case: `--exit` and `--timed-out` parsing and errors (malformed value, unknown key with the planned keys, key given twice), statuses `pass`, `fail`, `timeout`, `not-run`, verdicts, the exit line appended once, the 20-line tail, `--round` findings with the `not-run` summary, `env/plan-missing`, the `version: 3` result with `cwd` and `tests` (the scenarios of "Record the checks", "Output files", "Result file", "Red checks as findings")
- [x] 2.2 Implement `use-cases/record.ts`, `schema/record.ts` (result `version: 3`), `render/record.ts` and `commands/record.ts`; reuse `domain/verdict.ts` with the `not-run` status
- [x] 2.3 Write failing tests for the record text output (tail, cut tail, `not-run` line, skip lines, findings line)

## 3. CLI: remove bdk check run

- [x] 3.1 Change `plugins/bdk/tests/check.test.ts` (end-to-end tests through `bin/bdk`) to plan, run each printed line through `/bin/sh` the way the Bash tool does, and record; add a case asserting that `bdk check run` is now an unknown command
- [x] 3.2 Remove `commands/run.ts`, `use-cases/run.ts`, `render/run.ts`, `schema/run.ts`, `src/shared/shell/` and their tests; update `src/check/index.ts`, `src/main.ts` and the `why` of `src/slices.ts` when an edge goes; run `pnpm lint` (architecture rules) and `pnpm test`

## 4. Skills

- [x] 4.1 With `/skill-creator`, update the eval graders first: `implement-part-csv` gains a grader on the trace (`regex`, `target: trace`; a `tool_used: Bash` grader cannot load under the suite check's grants) for the red run's real command line from the fixture's settings and a grader that `checks/01.json` holds `"version":3` with `cwd`; `cli-route/graders/no-writing-bdk.md` and its prompt name `check record` instead of `check run`; `execute-wave-check`, `conform-part-violations`, `resolve-conflict-*` and `auto-review-first-round` graders keep reading the result fields and are checked against the new schema
- [x] 4.2 With `/skill-creator`, rewrite the check steps of `skills/implement-part/SKILL.md`: picking the tests (acceptance tests, existing tests of the changed modules, E2E specs of the touched flows), `bdk check plan` with `--tests`, each printed line as its own Bash call from the project root with the printed timeout, character for character and one after another, `bdk check record` with each exit code, reading a red check's output file, the picked tests in `## Checks`, a refused call as `Kind: environment`
- [x] 4.3 Same for `skills/conform-part/SKILL.md` and `skills/resolve-conflict/SKILL.md` (merge check with `--scope` and `--tests`, wave repair check without `--tests`)
- [x] 4.4 Same for `skills/execute-waves/SKILL.md` (wave check in the lead) and `skills/review-round/SKILL.md` (plan first, reviewers and the printed lines in one message, record with `--round` after the lines)
- [x] 4.5 Update `skills/cli/SKILL.md` (writing commands: `bdk check record`), `skills/diagnose-run/SKILL.md` (a check run is now plan, the agent's calls and record), `skills/setup/SKILL.md` and `skills/setup/references/stacks.md` (`Edit(.bdk/runs/**)` rule, `env.BASH_MAX_TIMEOUT_MS` for an item `timeout` above 600, `bdk check plan` in the `paths` text)
- [x] 4.6 Check every changed skill: the repository has no `skill-check` CI step or config, so `pnpm test` (skill, eval-suite and name tests) and `claude plugin validate plugins/bdk --strict` cover it

## 5. Measure in a test project

- [x] 5.1 In a separate test project started with `claude --plugin-dir`, with the settings `/bdk:setup` writes in `.claude/settings.json`, confirm in the default permission mode that the rule `Edit(.bdk/runs/**)` lets a printed line through, and that `env.BASH_MAX_TIMEOUT_MS` reaches the `bdk check plan` process run from the Bash tool; record both in `design.md`
- [x] 5.2 Add a `Budget` section to issue #408 for the eval runs of 5.3, then probe `implement-part-csv` and `execute-wave-check` with `--runs 1 --ablation none --model sonnet --max-cost-usd`, and the touched block cases once (`conform-part-*`, `resolve-conflict-*`, `cli-route`); record cost and machine time of every run in `design.md`

## 6. Docs

- [x] 6.1 `docs/concepts/orchestrators.md`: redraw every execute and review diagram that draws `bdk check run` (the red run, the part check, the conform check, the merge check, the wave check and its repair, the review round's check) as `bdk check plan`, the agent's Bash calls and `bdk check record`; update the text of "Where execute runs your checks" (the agent runs the command, picked tests, changed files of lint and build)
- [x] 6.2 `docs/guide/configuration.md` (what `{files}` receives, `--tests`, the `Edit` rule and `env.BASH_MAX_TIMEOUT_MS`), `docs/guide/footprint.md` (`checks/<id>/plan.json`, `.claude/settings.json` additions), `docs/concepts/cli-config-hooks.md`, `docs/concepts/findings.md`, `docs/concepts/run-state.md`, `docs/concepts/stages.md`: replace `bdk check run` and redraw any diagram that draws it
- [x] 6.3 Run `pnpm docs:reference` and check the regenerated `docs/reference/bdk/cli.md`, `settings.md` and `skills.md`

## 7. Acceptance and gates

- [x] 7.1 Check the Acceptance signal end to end: in the test project of 5.1, run `/bdk:implement-part` on a part and confirm the transcript shows the resolved test command as the implementer's own Bash call, and `checks/<id>.json` records the command, `cwd`, exit code and verdict
- [x] 7.2 Run every check CI runs (`.github/workflows/pr.yml`: `pnpm check` and the other jobs), `openspec validate v3-408-check-plan-record --strict` and `openspec validate --specs --strict`
