# Tasks

## 1. Settings schema

- [x] 1.1 Write failing tests in `plugins/bdk/src/config/tests/` for: `models.implementer: {model, effort}` validates and `config show` prints `models.implementer.model` / `.effort`; `models.planner.effort: extreme` names the allowed values; `models.implementor` is an unknown key suggesting `models.implementer`; `models.reviewer: sonnet` asks for a mapping; `policy.escalation.effort` validates; `bdk config set models.designer.effort xhigh` writes the key; every role of `MODEL_ROLES` has `plugins/bdk/agents/<role>.md`, in `plugins/bdk/tests/agent-models.test.ts` (verify: `pnpm vitest run plugins/bdk/src/config` fails)
- [x] 1.2 Change `settings.ts` (`MODEL_ROLES`, `EFFORTS`, `RoleModel`, `models` as `z.partialRecord`, `policy.escalation.effort`, descriptions and examples) and `keys.ts` (known names of an enum-keyed record) until the tests of 1.1 and the existing config and docs-reference tests pass (verify: `pnpm vitest run plugins/bdk/src/config scripts`)

## 2. Designer and planner agents

- [x] 2.1 Write the eval cases `design-draft-model-effort` and `plan-model-effort` (prompt, scaffold, graders on the `Agent` call's `subagent_type`, `model` and `effort`, and the written file), and add `Agent`/`SendMessage` to `allowed_tools` of the existing `design-draft-*`, `design-*`, `plan-draft-*` and `plan-*` cases (verify: the free eval check in `pnpm test` loads them)
- [x] 2.2 Add `plugins/bdk/agents/designer.md` and `planner.md` (`model: inherit`, tools `Read, Write, Edit, Bash, Grep, Glob, Skill`) with `/skill-creator` guidance for agent files (verify: `pnpm test` plugin and agent checks)
- [x] 2.3 With `/skill-creator`, change `design-draft` to run on `bdk:designer` (self-delegation with `models.designer`, questions relayed by the main thread) and `plan-draft` to run on `bdk:planner` (verify: skill-check in `pnpm check`)
- [x] 2.4 With `/skill-creator`, change `/bdk:design` and `/bdk:plan` to start `bdk:designer` / `bdk:planner` agents with model and effort, relaying designer questions (verify: skill-check)

## 3. Model and effort in every agent start

- [x] 3.1 Write the eval cases `implement-part-model-effort` and `execute-escalation-model-effort` (verify: free eval check loads them)
- [x] 3.2 With `/skill-creator`, change every agent start in `implement-part`, `conform-part`, `resolve-conflict`, `execute-waves` (escalation model and effort), `review-round`, `pr-review-round`, `verify-plan`, `execute`, `auto-review`, `pr-review` to pass `model` `models.<role>.model` and `effort` `models.<role>.effort` when set (verify: `grep -rn "models\.[a-z-]*\b[^.]" plugins/bdk/skills` finds no bare `models.<role>` model reference)

## 4. Docs

- [x] 4.1 Update `docs/guide/configuration.md` (Choose models, escalation, `bdk config set` example), `docs/guide/footprint.md`, `docs/guide/workflow.md`, `docs/concepts/agents.md`, `docs/concepts/cli-config-hooks.md`, `docs/concepts/stages.md`, `docs/concepts/orchestrators.md`, `docs/concepts/gates-and-budgets.md`, and `plugins/bdk/evals/README.md` for the new cases; run `pnpm docs:reference` (verify: `pnpm check` docs name check and stale Reference check pass)

## 5. Acceptance and gates

- [x] 5.1 Run the four new eval cases (and the changed `design-draft-*`, `plan-draft-*`) in the eval harness (a separate workspace per run, `claude --plugin-dir` equivalent) and record the results in design.md (verify: the `Agent` calls carry the configured `model` and `effort`)
- [x] 5.2 Run every CI check (`.github/workflows/`: `pnpm check`, docs-impact, commitlint), `openspec validate v3-278-config-model-effort-roles --strict` and `openspec validate --specs --strict`
