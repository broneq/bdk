## 1. Run-mode test

- [x] 1.1 Move the paragraph reader of `plugins/bdk/tests/agent-models.test.ts` into `plugins/bdk/tests/skill-agent-calls.ts`; `pnpm --filter bdk test agent-models` still passes
- [x] 1.2 Write `plugins/bdk/tests/agent-run-mode.test.ts` (D3): every Agent-call paragraph names `run_in_background: false` or `true`, and the lead skills' worker calls are found; run it and see it fail, naming the skills that lack the value

## 2. Eval case

- [x] 2.1 Add the grader `plugins/bdk/evals/auto-review-first-round/graders/workers-foreground.md` (D6) and check its pattern against the recorded fixture lead transcript (it must match the recorded background calls) and against a call that carries the field (it must not); `pnpm check` loads the case

## 3. Skill and agent texts (with /skill-creator)

- [x] 3.1 `agents/lead.md`: name `run_in_background: false`, forbid polling a worker's output and sleeping on a worker (D5)
- [x] 3.2 Lead skills `review-round`, `execute-waves`, `pr-review-round`: name `run_in_background: false` on every worker call; `pr-review-round` writes `subagent_type: "bdk:<agent>"` and `models.<agent>` per worker (D4)
- [x] 3.3 Orchestrators `execute`, `auto-review`, `pr-review` (lead: `true` / `false` by `execution.lead`, D1), `design`, `plan`, `close`, and the main-thread blocks (`implement-part`, `conform-part`, `resolve-conflict`, `plan-draft`, `verify-plan`, `spec-conformance`, `diagnose-run`, `explore`, `verify-design`, `design-draft`): name the value; the tests of group 1 pass
- [x] 3.4 `skill-check` passes on every changed skill and agent (`pnpm check`)

## 4. Docs

- [x] 4.1 `docs/concepts/agents.md`: a lead starts its workers with `run_in_background: false` and never polls them; `docs/guide/` needs no change (it names no run parameter)
- [x] 4.2 Run `pnpm docs:reference` and commit the regenerated `docs/reference/`

## 5. Acceptance and gates

- [x] 5.1 Acceptance signal: run `/bdk:debug` on the `debug-fix` scaffold with `claude -p --plugin-dir plugins/bdk` in a separate test project; every worker meta file of the review lead reads `requestShape: foreground`, and `bdk diagnostics report` lists no `slow-call` for the lead
- [x] 5.2 Every check CI runs (`.github/workflows/`), `openspec validate v3-326-lead-foreground-workers --strict` and `openspec validate --specs --strict`
