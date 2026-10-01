# Tasks

## 1. Kernel: the wave in `bdk next` (D1, D2, D7)

- [x] 1.0 Set the #61 card on the board to In progress
- [x] 1.1 Probe in a scratch repository with the built bundle: a `tiny` Change seeded like `execute-ab` (`seedV3`), `bdk next --json`, `bdk part start 01`, `attempt open task-redispatch 01-1`, `dispatch build`; then a `large` Change with two independent parts up to `plan-verify` done; record what `next` returns at each point, so the failing tests of 1.2 start from observed output
- [x] 1.2 Failing tests (`kernel/src/graph/tests/`, `kernel/src/config/tests/`): the `execution.tree` module defaults to `{enabled: true, min-parts: 2}` and refuses `min-parts: 1`; `features.workflow` is an unknown key; `next` on a `large` Change with parts 01 and 02 without `depends-on` returns `wave` with both `mode: tree`, `started: false`, `tickets: []`; the same plan on a `small` Change and with `enabled: false` gives `flat`; a part with an open `part-lead` ticket stays `tree` while a newly ready single part is `flat`; a dependent part is absent from `wave` until its dependency is done; `plan-verify` as next node has no `wave`; the `execute-part` instruction names `bdk next` after `bdk part done`
- [x] 1.3 The `execution.tree` config module (consumer `graph`), the mode rule as a pure function of the graph slice, `wave` in `nextStep` and `nextOutput`, `pipeline/execute-part.md`; `pnpm build` regenerates `schema/cli/output/next.json`; tests of 1.2 green; `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract` green
- [x] 1.4 Kernel E2E scenario for D6: after part 01 is done, an edit by part 02 to a file of part 01 makes a step node of part 01 the next node; `attempt open verify-fix 01` lists the `steps`, `dispatch build 01 runner <ticket>` builds the runner package, and evidence recorded under that ticket makes the step done again. A gap found here is fixed in this group, with its own failing test first (found: an `ok` close of a `verify-fix` ticket without an `implementer` package recorded no `simplify` manifest; a `simplifier` package now makes a code ticket too, delta `specs/kernel-cli/attempt`)

## 2. Swarm skill (role-contracts delta)

- [ ] 2.1 Failing contract test (`kernel/tests/contract/role-contracts.test.ts`): `skills/swarm/SKILL.md` names `wave` of `bdk next` as the source of `tree` and `flat`
- [ ] 2.2 Reword the Tree bullet of `skills/swarm/SKILL.md`; contract test green; `pnpm skill-check` green

## 3. `execute` stage skill (D3-D5, D8, D9)

- [ ] 3.1 Failing contract tests (`kernel/tests/contract/stage-skills.test.ts`, `skill-context.test.ts`): `skills/stages/execute/SKILL.md` exists with `disable-model-invocation: true` and `disallowed-tools: Edit Write NotebookEdit`; names `bdk next`, `wave`, `bdk part start`, `bdk attempt open part-lead`, `bdk dispatch build`, `bdk:lead`, `bdk attempt open task-redispatch`, `bdk:swarm`, `--escalate`, `bdk part done`, `bdk done spec-delta`, `verify-fix`, `/bdk:cr`, and the sentence that one `/bdk:execute` runs every ready part; the `ctx` manifest holds `execute`
- [ ] 3.2 `ctx skill execute` manifest entry (`Concurrency`, `decision` fragment), ctx tests and snapshot updated
- [ ] 3.3 Write `skills/stages/execute/SKILL.md` per `specs/stage-skills` and `.claude/rules/prompt-writing.md`, under 150 lines; review with `/bdk-skill-kit:skill-authoring`; tests of 3.1 green; `pnpm skill-check` green

## 4. Removal of the v2 executor (D10)

- [ ] 4.1 Failing test: no `skills/subagent-execute-plan/` remains, and `ctx skill bdk-implementer-return-contract` still prints the return contract from its new path
- [ ] 4.2 Move `references/return-contract.md` into `skills/bdk-implementer-return-contract/references/`, point the manifest entry at it, delete `skills/subagent-execute-plan/`, `pnpm skill-check --baseline-prune`; find the generator of `STARTUP_INSTRUCTIONS.md` and regenerate it; no live skill, agent or kernel source names `/bdk:subagent-execute-plan` (the `execute-ab` suite's tagged v2 copy excepted); tests green

## 5. `stages` eval cases (D12)

- [ ] 5.1 Failing harness tests (`evals/suites/stages/*.test.ts`): a case accepts `seed`, `pnpm eval check` refuses an unknown seed naming the case; seed `audit-csv` leaves `next` at `execute-part:01` with one `flat` part; seed `two-independent-parts` leaves `next` with `wave` of two `tree` parts on a `large` Change (both without a model)
- [ ] 5.2 `evals/suites/stages/seeds.ts` with `audit-csv` (reusing `readTask` and `seedV3` of `execute-ab`) and `two-independent-parts` (design parts, architecture, design index, a recorded `design-verify` verdict, the design gate passed through `bdk hooks prompt-expansion` with a recorded `/bdk:plan` payload, plan parts for `src/ui/format.ts` and `src/api/http.ts`, a recorded `plan-verify` verdict); the `seed` field in `cases.ts` and its run in `hooks.ts`; tests of 5.1 green
- [ ] 5.3 Case file `evals/suites/stages/cases/execute.yaml` (`flat`, `tree`, `not-ready`) with `features.lavish false`; extend `STAGE_SKILLS`; `pnpm eval check` green
- [ ] 5.4 After the user approves the cost: `pnpm eval stages --skill execute --probe --budget <ledger + margin>`; fix what fails, each fix with its test first, and record the outcome in the PR

## 6. Documentation

- [ ] 6.1 `docs/guide/reference/skills.md` (`/bdk:execute` section, v2 section removed), `reference/artifacts.md` (execute stage), `reference/configuration` page for `execution.tree`, and the workflow, concept and getting-started pages that name `/bdk:subagent-execute-plan`; the v2 agent pages for `implementer` and `fixer` say "BDK 2 agent; no BDK 3 skill starts it"; `pnpm docs:build` green
- [ ] 6.2 README skill table and pipeline section; `docs/V3-IMPLEMENTATION-PLAN.md` T41 scope: `execute` done the v3 way and `features.workflow` dropped with the reason (decision 2), and the design's open item "Workflow strategy details" closed

## 7. Acceptance

- [ ] 7.1 Sync the main specs (`stage-skills`, `kernel-cli/graph`, `kernel-settings`, `role-contracts`, `skill-evals`) with the deltas
- [ ] 7.2 Full gate: `pnpm build`, lint, format, typecheck, knip, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `pnpm docs:build`, `pnpm eval check`, `pnpm lint:py`, `pytest tests/unit/`
- [ ] 7.3 Acceptance signal end to end: the `flat` and `tree` probe rows pass (5.4); `/bdk:execute` resolves to one skill under 200 lines with the P9 frontmatter
- [ ] 7.4 `openspec validate v3-t41-execute --strict` and `openspec validate --specs --strict`
