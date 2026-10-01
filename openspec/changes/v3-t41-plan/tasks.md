# Tasks

## 1. Kernel: the plan stage (D6)

- [x] 1.0 Set the #61 card on the board to In progress
- [x] 1.1 Probe in a scratch repository with the built bundle: a `bug` Change, a typed `/bdk:plan` through `hooks prompt-expansion`, `next` returns `plan`; record whether the stage-command check refuses, and add a failing test plus a fix to this group if it does
- [x] 1.2 Failing tests: the `plan` instruction lists `BDK-PL-1..3`; `plan-verify` requires `plan`, `design`, `design-index` and `architecture`, and a `bug` Change still reaches it after `plan`; the `plan-verify` package names `design.md`, `architecture.md` and every plan part; an edited spec delta makes `plan-verify` stale; a `done design` newer than the report fails `fresh` on `plan-verify` (`kernel/src/graph/tests/`, `kernel/src/dispatch/tests/`)
- [x] 1.3 `pipeline/pipeline.yaml` (rules and requires), `PlanVerifyKind.inputs` with the `spec-delta/` files, `pipeline/plan-part.md` and `pipeline/plan-verify.md`; update graph tests that list `plan-verify`'s requirements; tests of 1.2 green; `pnpm build`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract` green

## 2. `verifier` contract (D7)

- [x] 2.1 Failing contract test: `skills/roles/verifier/SKILL.md` verifies every plan part the package names together with the design and names the checks for test cases, design coverage and dependencies between parts
- [x] 2.2 Rewrite the work section of the contract per `specs/role-contracts`; `node dist/bdk.mjs export agents --host claude` if the export changes; tests green

## 3. `verify-plan` (D5, D8)

- [x] 3.1 Failing contract test: the manifest and skill set include `verify-plan` under `skills/stages/`; no `skills/verify-plan/` remains; the skill names `attempt open verifier plan-verify`, `dispatch build`, `attempt close` and `done plan-verify`, and sets no `disable-model-invocation`
- [x] 3.2 `ctx skill verify-plan` manifest entry (no part) and `skills/stages/verify-plan/SKILL.md` per `specs/stage-skills` and `.claude/rules/prompt-writing.md`; delete `skills/verify-plan/`; review with `/bdk-skill-kit:skill-authoring`; `pnpm skill-check` green

## 4. `plan` (D1-D4, D8)

- [x] 4.1 Failing contract test: `plan` lives under `skills/stages/` with `disable-model-invocation: true`; no `skills/create-plan/` remains; it names `bdk next`, `bdk done plan`, `bdk spec delta check`, `/bdk:verify-plan`, `bdk part list`, `--review` and `/bdk:execute`; its reference is linked from `SKILL.md`; the manifest holds `plan` and no `create-plan`
- [x] 4.2 `skills/stages/plan/references/task-shape.md`: one worked part (contract, concrete test cases, stop rule) and the contrast with topic-only test cases
- [x] 4.3 `ctx skill plan` manifest entry; `skills/stages/plan/SKILL.md` per `specs/stage-skills` (plan requirements); delete `skills/create-plan/`; update `kernel/src/ctx/tests/skill.test.ts` and the ctx snapshot; `pnpm skill-check --baseline-prune`; review with `/bdk-skill-kit:skill-authoring`; `pnpm skill-check` green
- [x] 4.4 `skills/debug/SKILL.md` Phase 5b hands a large fix to the user's `/bdk:change` and `/bdk:plan`; no live skill names `/bdk:create-plan`

## 5. `stages` eval cases (D9)

- [x] 5.1 Failing harness test: `stageSkill` accepts `plan` and `verify-plan`, and `pnpm eval check` renders their configs
- [x] 5.2 Case files `evals/suites/stages/cases/plan.yaml` (`bug`; no `no-change` case, see D9) and `verify-plan.yaml` (`clean`, `false-claim`, `not-ready`), each preparing `features.lavish false`; extend `STAGE_SKILLS`; `pnpm eval check` green
- [x] 5.3 After the user approves the cost: `pnpm eval stages --skill verify-plan --probe --budget <ledger + margin>` and `--skill plan --probe`; fix what fails and record the outcome in the PR

- [x] 5.4 After the first `plan` probe: the guard block reason names `instead` (`kernel-cli` delta, `blockReason`, registry, pre-tool and guard e2e tests); `plan` sizes the plan to the intent and the verifier scopes edge cases to it; the `bug` case expects one part

- [x] 5.5 After the second `plan` probe: scope grows only to keep correct what the Change breaks, within the existing parts; larger growth is a `finding` for a follow-up Change, and a scope question offers the intent-only option; the kernel's budget is the only limit on rounds (contract test needles)

- [x] 5.6 After the third `plan` probe (`shared-bug` passed, `bug` parked after edits that followed passing verdicts): a passing verdict closes the plan and its findings go to execution

## 6. Documentation (D10)

- [x] 6.1 `docs/guide/reference/skills.md`, `reference/artifacts.md`, `concepts/plan-pipeline.md`, the workflow and getting-started pages that name `/bdk:create-plan` or `/bdk:verify-plan`, README's skill table; add rewritten pages to `V3_PAGES`; `pnpm docs:build` and `pnpm test:contract` green
- [x] 6.2 Sync the main specs with the deltas: `stage-skills`, `kernel-pipeline`, `role-contracts`

## 7. Acceptance

- [x] 7.1 The 5.3 probes show `/bdk:plan` leaving `plan` and `plan-verify` done on a `bug` Change with a report naming `/bdk:execute`, and `/bdk:verify-plan` raising a `false-code-claim` blocker on a false claim
- [x] 7.2 Full gate: `pnpm build`, lint, format, typecheck, knip, `test:unit`, `test:e2e`, `test:contract`, `skill-check`, `docs:build`, `eval check`, `pytest tests/unit/`
- [x] 7.3 `openspec validate v3-t41-plan --strict`
