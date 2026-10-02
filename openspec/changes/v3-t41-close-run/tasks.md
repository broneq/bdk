# Tasks

## 1. Host facts (D9)

- [x] 1.0 Set the #61 card on the board to In progress
- [x] 1.1 Add the checks `skill-tool-pretool`, `skill-tool-upe` and `skill-tool-disallowed` to `tests/host-probe/` (a probe skill without `disable-model-invocation` and with `disallowed-tools: Edit Write NotebookEdit`, started by the model through `Skill`, then a second probe skill in the same turn that needs `Write`); after the user approves the small cost, run them headless on the current Claude Code version, record the payloads under `tests/fixtures/host-payloads/<version>/` (`pre-skill.json` among them, placeholders replaced) and the rows in `docs/HOST-FACTS.md`. Gate: if `skill-tool-pretool` or `skill-tool-disallowed` contradicts the design, stop and take the decision back to the user before group 2

## 2. Kernel: run marker and stage-skill guard (D2-D5)

- [x] 2.1 Failing tests for the run marker (`kernel/src/hooks/tests/`): `/bdk:run --auto "<intent>"` without a Change writes `.bdk/.machine/runs/<session>.json` with `auto: true`, `change-started: false` and the typed prompt; `/bdk:run "<intent>"` with an active Change refuses `policy/change-exists` and writes nothing; `/bdk:run` with neither refuses `policy/no-active-change` naming `/bdk:run "<intent>"`; `/bdk:run --auto` with an active Change passes a ready `manual` gate with `source: policy` and `command` = the typed line; a typed `/bdk:plan` removes its session's marker before its gate outcome and leaves another session's marker; `hooks session-end` removes the session's marker with and without an active Change; a `session_id` outside `^[A-Za-z0-9_-]+$` is `input/invalid-argument`
- [x] 2.2 Implement the marker in `shared/store` (schema, read that treats an unparsable file as absent, write, remove), the `/bdk:run` outcomes in `prompt-expansion` (intent and `--auto` from `command_args`), the removal in `prompt-expansion` and `session-end`; tests of 2.1 green
- [x] 2.3 Failing tests for the guard (`kernel/src/hooks/tests/`, recorded `pre-skill.json` with placeholders): `Skill` `bdk:execute` without a marker is `guard/stage-skill`; from a payload with `agent_id` is `guard/stage-skill`; a second `bdk:change` in one run is `guard/stage-skill`, the first sets `change-started`; `bdk:design` without a marker passes and writes nothing; inside a run `bdk:plan` with `gate:design` ready and `policy.gates.design: auto` writes `source: policy` with the marker's prompt as `command`; the same with `manual` and no `--auto` is `guard/gate-manual` naming `/bdk:plan`; with `--auto` it passes; `design` not done is `policy/gate-not-ready`; gate already done passes without a write; `bdk:execute` inside a run writes the plain stage transition once; an unparsable marker denies
- [x] 2.4 Split the gate outcome of `prompt-expansion` into one use case with the source as a parameter; the `Skill` guard in `pre-tool` (payload fields `session_id`, `tool_input.skill`, Change resolved only for an admitted stage skill), rules `guard/stage-skill` and `guard/gate-manual` in `shared/refusal` and the deny reasons; `Skill` in the `pre-tool.sh` prefilter; `schema/cli/commands.json` (`hooks pre-tool` writes, refusals and mode text, `hooks prompt-expansion` and `hooks session-end` writes and refusals); `pnpm build`; tests of 2.3 green
- [x] 2.5 E2E through `dist/bdk.mjs` (`kernel/src/hooks/tests/*.e2e.ts`): typed `/bdk:run` payload, then a `Skill` `bdk:plan` payload of the same session passes `gate:design` by policy and `bdk next --json` no longer waits for it; a `Skill` `bdk:close` payload in another session is denied; `pre-tool.sh` with `pre-skill.json` starts the kernel; `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract` green (write map contract: `hooks pre-tool` writes `log/`). Found here: the gate rule ignored a `source: policy` pass of a `manual` gate under `--auto`; fixed with the `auto` field of a transition, read by the gate rule (index schema version 6; deltas `kernel-pipeline`, `kernel-state`; D4; user decision 2026-10-02)

## 3. Stage skill frontmatter (D1)

- [x] 3.1 Failing contract and content tests: `setup` and `run` set `disable-model-invocation: true`; `change`, `plan`, `execute` and `close` do not; `execute` and `close` keep `disallowed-tools: Edit Write NotebookEdit`; `pnpm skill-check` errors when `run` omits the field
- [x] 3.2 Remove the field from `skills/stages/{change,plan,execute}/SKILL.md`, update `skill-check.config.ts` ("User-only entries"), `pnpm skill-check --baseline-prune` if a finding disappears; tests of 3.1 green

## 4. `close` stage skill (D8)

- [ ] 4.1 Failing contract tests (`kernel/tests/contract/stage-skills.test.ts`, `skill-context.test.ts`): `skills/stages/close/SKILL.md` exists with `disallowed-tools: Edit Write NotebookEdit` and no `disable-model-invocation`; names `bdk change close --dry-run`, `bdk change close`, `bdk rules export --claude --check`, `bdk rules export --claude`, `gatesByPolicy`, and says it opens no PR; the `ctx` manifest holds `close` with no parts
- [ ] 4.2 `ctx skill close` manifest entry; write `skills/stages/close/SKILL.md` per `specs/stage-skills` and `.claude/rules/prompt-writing.md`; review with `/bdk-skill-kit:skill-authoring`; tests of 4.1 green; `pnpm skill-check` green

## 5. `run` stage skill (D6, D7, D10)

- [ ] 5.1 Failing contract tests: `skills/stages/run/SKILL.md` exists with `disable-model-invocation: true` and `allowed-tools` `Skill`, `Read` and the kernel wrapper pair; names `bdk next`, the `Skill` tool, `/bdk:change`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:cr`, `/bdk:close`, `bdk log add decision` with `--review`, `guard/gate-manual`, and the stop conditions; the `ctx` manifest holds `run` with no parts
- [ ] 5.2 `ctx skill run` manifest entry; write `skills/stages/run/SKILL.md` per `specs/stage-skills` and `.claude/rules/prompt-writing.md`, under 120 lines; review with `/bdk-skill-kit:skill-authoring`; tests of 5.1 green; `pnpm skill-check` green

## 6. `stages` eval cases (D11)

- [ ] 6.1 Failing harness test (`evals/suites/stages/seeds.test.ts`): seed `reviewed` leaves a `tiny` Change whose `review` node is done, `gate:review` ready and no ticket open, with a clean work tree (no model)
- [ ] 6.2 Seed `reviewed` in `evals/suites/stages/seeds.ts`, built through the kernel: one part, one task committed with `bdk commit`, step evidence recorded, `part done`, `done spec-delta`, a passing `review` report and `done review`; test of 6.1 green
- [ ] 6.3 Case files `close.yaml` (`happy`, `ticket-open`) and `run.yaml` (`run-auto`, `run-manual`, `run-close`) with `features.lavish false`; extend `STAGE_SKILLS`; `pnpm eval check` green
- [ ] 6.4 After the user approves the projected cost: `pnpm eval stages --skill close --probe` and `pnpm eval stages --skill run --probe`; fix what fails, each fix with its test first; record the outcome in this file and the PR

## 7. Documentation

- [ ] 7.1 `docs/guide/reference/skills.md` (`/bdk:close`, `/bdk:run` with `--auto`, which skills the model may start and the guard), the workflow pages and the guide page on gates and policy (the run marker, `source: policy`, how to keep everything manual); README skill table and pipeline section; `pnpm docs:build` green
- [ ] 7.2 `docs/V3-IMPLEMENTATION-PLAN.md`: T41 Delivery item 6 states the YOLO mode (user decision 2026-10-02), OD-7 revised for `change`, `plan`, `execute`, `close`, and the acceptance split with T42; a comment on #62 (T42) names the `review` node, the `run` E2E to `closed` and the `disallowed-tools` finding of 1.1 for `cr`

## 8. Acceptance

- [ ] 8.1 End to end on the acceptance signal: the content tests and `pnpm skill-check` green; no stage skill over 200 lines; the probes of 6.4 pass (`close` happy path, `run-auto` to the review stage, `run-manual` stopping at `gate:design`, `run-close` ending `closed` with `source: policy` on `gate:review`); `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract` green
- [ ] 8.2 `openspec validate v3-t41-close-run --strict` and `openspec validate --specs --strict` green
