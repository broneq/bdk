# Tasks

## 1. Parity test (test first)

- [x] 1.1 Write `plugins/bdk/tests/agent-models.test.ts`: every `plugins/bdk/agents/*.md` is a backticked role of the `models` description, every backticked role is an agent, and every `SKILL.md` paragraph with `subagent_type: "bdk:<agent>"` names `models.<agent>`; run it and see it fail on `explorer` and on `design`, `explore`, `verify-design`, `close`, `spec-conformance`
- [x] 1.2 Add `explorer` to the `models` description in `plugins/bdk/src/config/domain/settings.ts`

## 2. Eval cases (before the skill text)

- [x] 2.1 Add orchestrator cases `design-models-per-role`, `plan-models-verifier`, `close-models-verifier` with `tool_used` graders on the `Agent` input (`subagent_type` and `model` `sonnet`)
- [x] 2.2 Add block cases `explore-model-set`, `verify-design-model-set`, `spec-conformance-model-set`
- [x] 2.3 Run `pnpm --filter @bdk/bdk test` (the eval loader check) and see the cases load

## 3. Skills (with /skill-creator)

- [x] 3.1 `design`: explore passes `models.explorer`, verify-design passes `models.verifier`
- [x] 3.2 `explore` and `verify-design`: the agent they start in the main thread gets `models.explorer` / `models.verifier`
- [x] 3.3 `close` and `spec-conformance`: the `bdk:verifier` call gets `models.verifier`
- [x] 3.4 Run the parity test green; run the new eval cases in a separate project through the eval harness (`claude --plugin-dir` scaffolds) and record the results in this Change

## 4. Docs

- [x] 4.1 `docs/concepts/cli-config-hooks.md`: `/bdk:design` row reads `models.explorer`, `models.verifier`; `/bdk:close` row reads `models.verifier`; the key table lists `models.explorer`
- [x] 4.2 `docs/concepts/agents.md`: list `explorer` among the roles, drop the #274 known-limit sentence
- [x] 4.3 `docs/guide/configuration.md`: say a role is the agent's name
- [x] 4.4 Run `pnpm docs:reference`

## 5. Acceptance and gates

- [x] 5.1 Acceptance: the eval results show `model: sonnet` on the verifier calls of design, plan and close, and on the explorer call; the settings description and `docs/concepts/cli-config-hooks.md` list the same roles
- [x] 5.2 Run every CI check (`pnpm check`, the jobs of `.github/workflows/pr.yml`), `openspec validate v3-274-models-per-agent --strict` and `openspec validate --specs --strict`
