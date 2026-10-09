# Proposal

## Why

Tracks #278.

A project can choose the model of an agent role (`models.<role>`), but not its reasoning effort, and not the model or effort of the two author blocks that do the most thinking: `design-draft` and `plan-draft` run in the main thread on the session's model, so no setting reaches them. The last implementer run of a failing part escalates the model (`policy.escalation.model`) but cannot raise the effort. Every team tunes cost against quality differently (problem 4 of v3, configurability, in CLAUDE.md "Goal of this line"); today they can do it for half of the work and not at all for effort. A typo in a role name (`models.implementor`) is also accepted and silently ignored.

## What Changes

- **BREAKING** `models.<role>` becomes a mapping `{ model, effort }` (both optional) instead of a model string: `models.implementer.model: opus`, `models.implementer.effort: high`. A string value is a problem that names the new form. `bdk config set models.<role>.model` and `models.<role>.effort` address the fields.
- `models` accepts only the known roles: `lead`, `explorer`, `verifier`, `implementer`, `conformer`, `reviewer`, `integration-reviewer`, `e2e-tester`, `judge`, and the new `designer` and `planner`. Any other key is a problem with a "did you mean" suggestion.
- `effort` takes Claude Code's effort levels: `low`, `medium`, `high`, `xhigh`, `max`. Not set means the skill passes no `effort`, so the agent runs at the session's effort.
- `policy.escalation` gains `effort` next to `model`; the last implementer run of a part, and the second `resolve-conflict` run, use both.
- New agents `bdk:designer` (runs `design-draft`) and `bdk:planner` (runs `plan-draft`), `model: inherit` so an unset role keeps today's model (the session's). `/bdk:design`, `/bdk:plan` and the blocks typed by a user start them as agents with `models.designer` / `models.planner`. Questions of `design-draft` that Lavish cannot take reach the user through the main thread.
- Every skill that starts a BDK agent passes `effort` next to `model` when the configuration sets it: `implement-part`, `conform-part`, `resolve-conflict`, `execute-waves`, `review-round`, `pr-review-round`, `plan`, `verify-plan`, `execute`, `auto-review`, `pr-review`, `design`, `design-draft`, `plan-draft`.
- Eval cases that show a run uses the configured model and effort in its agent calls.

#274 (merged first) made every agent a `models` role, added `models.explorer` and passed `models.verifier` in every stage; this Change moves those calls to the `{ model, effort }` shape.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/config`: the `models.<role>` row becomes `models.<role>.model` and `models.<role>.effort` with the known roles; `policy.escalation.effort` is added; the show scenario uses the new key; "Every agent is a models role" (from #274) gains `designer` and `planner` and passes `effort` next to `model`.
- `bdk-execute`: the escalated run uses `policy.escalation.effort` as well as `policy.escalation.model`.
- `design-blocks`: the agent `bdk:designer`; `design-draft` runs on it; questions it cannot ask through Lavish reach the user through its caller.
- `bdk-design`: `/bdk:design` starts `design-draft` as a `bdk:designer` agent and relays its questions.
- `bdk-plan-blocks`: the agent `bdk:planner`; `plan-draft` runs on it.
- `bdk-plan`: `/bdk:plan` starts `plan-draft` as a `bdk:planner` agent.

## Impact

- Code: `plugins/bdk/src/config/domain/settings.ts` (schema), `keys.ts` (known roles for "did you mean"), their tests; `scripts/docs-reference` if the record rendering needs it.
- Plugin: new `plugins/bdk/agents/designer.md`, `planner.md`; the skills listed above; eval cases under `plugins/bdk/evals/`.
- User docs: `docs/guide/configuration.md` (Choose models, escalation), `docs/guide/footprint.md`, `docs/concepts/agents.md`, `docs/concepts/cli-config-hooks.md`, `docs/concepts/stages.md`, `docs/concepts/orchestrators.md`, `docs/concepts/gates-and-budgets.md`, `docs/guide/workflow.md`, and the Reference regenerated (`settings`, `agents`).
- Users: a settings file with `models.<role>: <model>` no longer validates; `bdk config check` names the key and the new form.
