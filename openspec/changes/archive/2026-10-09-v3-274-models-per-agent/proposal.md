# Proposal

## Why

Tracks #274.

`models.<role>` is meant to choose the model of every agent role a user sees in the docs, but it reaches only some `Agent` calls. `bdk:explorer` has no role, so its model cannot be changed, and `models.verifier` is passed by `/bdk:plan` (`verify-plan`) while `/bdk:design` (`verify-design`) and `/bdk:close` (`spec-conformance`) start `bdk:verifier` on its default model. A user who sets `models.verifier: sonnet` gets sonnet in one of three stages and no error. The documentation review of #268 found the gap; `docs/concepts/agents.md` names it as a known limit.

## What Changes

- `explorer` becomes a configurable role: `models.explorer` sets the model of `bdk:explorer` (resolves "To resolve in the spec").
- Every agent the `bdk` plugin ships is a `models` role, and every skill text that starts an agent of the plugin passes `model` set to `models.<agent>` when the configuration sets it. `policy.escalation.model` keeps its precedence on the last implementer run of a part (spec `bdk-execute`).
- The skills that start `bdk:explorer` or `bdk:verifier` without a model now pass it: `design` (explore, verify-design), `explore`, `verify-design`, `close` (spec-conformance) and `spec-conformance`.
- The `models` settings description lists `explorer` with the other roles.
- A workspace test keeps the three in step: every agent file of `plugins/bdk/agents/` is a role named in the `models` description, and every skill paragraph that starts `subagent_type: "bdk:<agent>"` names `models.<agent>`.
- Eval cases record that `models.verifier: sonnet` and `models.explorer: sonnet` reach the agents of the design, plan and close stages.
- Docs: `docs/concepts/cli-config-hooks.md` (stage diagram and key table), `docs/concepts/agents.md` (the known-limit sentence goes), `docs/guide/configuration.md` (role list), and the settings Reference regenerated.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/config`: a new requirement that every agent of the plugin is a `models` role, listed in the description, and that every `Agent` call of a skill passes it.
- `bdk-design`: explore and verify-design start with `models.explorer` and `models.verifier`.
- `design-blocks`: `explore` and `verify-design`, when they start their own agent, pass `models.explorer` and `models.verifier`.
- `bdk-close`: spec-conformance starts with `models.verifier`.
- `bdk-spec-conformance`: the block, when it starts its own agent, passes `models.verifier`.

## Impact

- Skills: `plugins/bdk/skills/{design,explore,verify-design,close,spec-conformance}/SKILL.md`.
- Code: `plugins/bdk/src/config/domain/settings.ts` (description of `models` only; the schema shape `models: record<role, model>` stays as it is, so no stored setting changes).
- Tests: a new `plugins/bdk/tests/agent-models.test.ts`.
- Evals: new cases under `plugins/bdk/evals/`.
- User docs: `docs/concepts/cli-config-hooks.md`, `docs/concepts/agents.md`, `docs/guide/configuration.md`, `docs/reference/bdk/settings.md` (generated).
- Out of scope: effort per role and the designer and planner roles (#278); `models.<role>` keeps its shape here so #278 can extend it.
