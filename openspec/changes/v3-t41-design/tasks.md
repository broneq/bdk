# Tasks

## 1. Kernel: `design-verify` and the `fresh` check (D1, D2)

- [x] 1.0 Set the #61 card on the board to In progress
- [x] 1.1 Failing tests: the registry holds sixteen kinds; `design-verify` sits between `architecture` and `gate:design` for `small` and `large` feature Changes and is absent for `tiny` and `bug`; `bdk done design-verify` without a report is `policy/validation-failed`; a design change makes `design-verify` stale; `gate:design` is not ready until `design-verify` is done (`kernel/src/graph/tests/`)
- [x] 1.2 Add `DesignVerifyKind` (inputs: `design.md`, `architecture.md`, design parts that exist), register it in `KIND_NAMES` and the kind index, add the node to `pipeline/pipeline.yaml`, `gate:design` requires it, `pipeline/design-verify.md`; update `schema/` outputs that list kinds; tests of 1.1 green
- [x] 1.3 Failing tests for check `fresh` on `design-verify`, `plan-verify` and `review`: a passing report older than the latest `done` of a required node fails `fresh`, one of the same second passes
- [x] 1.4 Implement `fresh` in `verdictChecks`; adjust kernel fixtures that write a report before the verified node's `done`; `pnpm test:unit`, `pnpm test:e2e` (after `pnpm build`) and `pnpm test:contract` green
- [x] 1.5 Probe in a scratch repository with the built bundle: `change new`, `done design`, `done architecture`, `next` returns `design-verify`, `attempt open verifier design-verify` and `dispatch build design-verify design-verifier <ticket>` succeed and the package names `design.md` and `architecture.md`
- [x] 1.6 Failing tests, then `log add report --ticket`: fills `report` from the ticket's package, adds the target to the refs, refuses before `log ingest` and without `--ticket`, never deduplicates (`kernel/src/log/tests/ingest.test.ts`); the verdict's `instead` names it; `schema/cli/commands.json`; deltas `kernel-cli/log` and `role-contracts` (D10)
- [x] 1.7 `verifier` and `design-verifier` contracts record the report after `log ingest` (contract test); E2E through the bundle: `attempt open verifier design-verify`, `dispatch build`, `log ingest`, `log add report`, `attempt close ok`, `done design-verify` (`kernel/src/graph/tests/graph.e2e.ts`)

## 2. Asking the user in two tiers (D6)

- [x] 2.1 Failing contract test: both `fragments/decision/*.md` state the simple and the rich tier; the Lavish fragment names `--help`, `poll` and the fallback and no flag that `lavish-axi --help` does not print; the ask-user fragment states what the terminal loses
- [x] 2.2 Rewrite `fragments/decision/lavish.md` and `ask-user.md`; update `kernel/src/ctx/tests/skill.test.ts` expectations that quote them; tests green

## 3. `verify-design` (D3, D7)

- [x] 3.1 Failing contract test: the manifest and skill set include `verify-design`; the skill names `attempt open verifier design-verify`, `dispatch build`, `attempt close` and `done design-verify`, and sets no `disable-model-invocation`
- [x] 3.2 `ctx skill verify-design` manifest entry (no part) and `skills/stages/verify-design/SKILL.md` per `specs/stage-skills` and `.claude/rules/prompt-writing.md`; review with `/bdk-skill-kit:skill-authoring`; `pnpm skill-check` green

## 4. `design` (D4, D5, D7)

- [x] 4.1 Failing contract test: `design` lives under `skills/stages/`, no `skills/design/` remains, it names `bdk next`, `bdk log add decision`, `/bdk:verify-design` and `bdk change status`, and its references are linked from `SKILL.md`
- [x] 4.2 `skills/stages/design/references/approaches.md` and `references/schema-gate.md` (carried over from the v2 skill and its self-critique checklist, adapted to ledger entries)
- [x] 4.3 `skills/stages/design/SKILL.md` per `specs/stage-skills` (design requirements); delete `skills/design/`; `pnpm skill-check --baseline-prune`; review with `/bdk-skill-kit:skill-authoring`; `pnpm skill-check` green

## 5. `stages` eval cases (D8)

- [x] 5.1 Failing harness test: `stageSkill` accepts `design` and `verify-design`, and `pnpm eval check` renders their configs
- [x] 5.2 Case files `evals/suites/stages/cases/design.yaml` (`small-feature`, `no-change`) and `verify-design.yaml` (`clean`, `false-claim`, `not-ready`), each preparing `features.lavish false`; extend `STAGE_SKILLS`; sync the `skill-evals` main spec; `pnpm eval check` green
- [x] 5.3 After the user approves the cost: `pnpm eval stages --skill verify-design --probe --budget <ledger + margin>` and `--skill design --probe`; fix what fails and record the outcome in the PR
- [x] 5.4 Fixes from the first 5.3 probe (D11): failing tests, then `log add blocker --ticket` names the target and `log list` summaries carry `category` (`ingest.test.ts`, E2E in `graph.e2e.ts`); `verify-design` reports `narrow`; the `clean` case verifies a design that only states what the fixture holds; delta `kernel-cli/log`

## 6. Documentation (D9)

- [x] 6.1 `docs/guide/reference/skills.md`, `reference/artifacts.md`, the workflow pages that describe the design stage, README's skill table; add rewritten pages to `V3_PAGES`; `pnpm docs:build` and `pnpm test:contract` green
- [x] 6.2 Sync the main specs with the deltas: `stage-skills`, `kernel-pipeline`, `skill-evals`

## 7. Acceptance

- [x] 7.1 The 5.3 probes show `/bdk:design` leaving `gate:design` ready with `design-verify` done, and `/bdk:verify-design` raising a `false-code-claim` blocker on a false claim
- [x] 7.2 Full gate: `pnpm build`, lint, format, typecheck, knip, `test:unit`, `test:e2e`, `test:contract`, `skill-check`, `docs:build`, `eval check`, `pytest tests/unit/`
- [x] 7.3 `openspec validate v3-t41-design --strict`
