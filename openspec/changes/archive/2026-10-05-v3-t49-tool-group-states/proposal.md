## Why

Scope: #117 (https://github.com/broneq/bdk/issues/117). Tracks #117. Depends on T42 (#62).

A tool group (`tools.test`, `tools.lint`) has one state today: a list, empty by default. An unset `tools.lint` therefore looks exactly like a project without a linter, and the kernel cannot tell the two apart. The T42 `run-auto` stage probe (2026-10-04, `evals/results/stages/probe-run-2026-10-04.jsonl`) showed the result: the case set `tools.test` only, every task recorded `lint` as `not-run`, the review-fix close was refused with `policy/missing-evidence` (4 not-run manifests above the budget of 3), and the round closed `not-run`. A project without a linter has no way to say so, and a project that forgot to configure one learns it several tasks in, from a budget refusal. T42 only fixed the eval cases.

## What Changes

- **Three states per tool group.** `tools.test` and `tools.lint` are each either _configured_ (a list of one or more entries), _declared none_ (the value `none`) or _unset_ (no layer sets the key). An empty list is refused by `bdk config check`, with a hint to list an entry or set `none`, so every state has exactly one spelling. `tools.build` keeps its list form: no pipeline step runs it.
- **Declared none: the group's nodes do not apply.** The step nodes of a declared-none group (`tests-scoped` and `tests-full` for `test`, `lint` and `lint-full` for `lint`) are `skipped` in the Change's graph, with `why` naming the setting. A requirement on a skipped node is satisfied, so `review` no longer waits for them, the runner package and the review round's gate runner no longer list them, and `attempt close` no longer asks for their evidence. No `not-run` manifest is recorded for them.
- **Unset refuses early.** `bdk change new` and `bdk part start` refuse with the new rule `policy/tools-unset` when a group whose nodes the Change runs is unset. `instead` names `bdk config set tools.<group>.<id> ...`, `bdk config set tools.<group> none` and `/bdk:setup`. The run never reaches the not-run budget for a missing setting.
- **Status and reports name it.** `bdk change status` gains `tools`, the state of each group, and its text form says which group is not used. A declared-none `tools.test` is a warning: "this Change runs no test". The review report's Gate section says `not used` for a declared-none group, as a warning for tests. The close report gains `toolsNotUsed` and a `### Checks` section in its PR summary.
- **`/bdk:setup` declares none.** When the project has no tool of a group, the skill asks the user and on a yes runs `bdk config set tools.<group> none`. The skill context shows each group's state (`declared none`, `unset`) instead of "none configured".
- **Eval case.** The `run-auto` and `run-manual` stage cases declare lint none (`tools.lint none`) instead of configuring eslint, which is the acceptance signal of #117.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-settings`: Tool entries (the three states and the `none` value); Keys of the project toolchain (type and default of `tools.test` and `tools.lint`).
- `kernel-pipeline`: new requirement "Tool group nodes": a declared-none group skips its nodes.
- `kernel-cli`: the rule catalogue gains `policy/tools-unset`.
- `kernel-cli/change`: `change new` refuses an unset group; `change status` reports `tools`; `change close` reports `toolsNotUsed`.
- `kernel-cli/part`: `part start` refuses an unset group.
- `kernel-cli/dispatch`: the runner `Checks` and the gate runner's checks leave out a declared-none group.
- `kernel-cli/review`: the Gate section of `review render` names a declared-none group as not used.
- `kernel-cli/ctx`: the `tools` part renders the declared-none and unset states.
- `kernel-cli/config`: `config set` of an existing id item keeps its `id` (a second set of the same entry wrote an item without one, found while seeding the stage cases), and `none` replaces a group or is replaced by an entry.
- `stage-skills`: `/bdk:setup` writes the declared-none state after asking.
- `skill-evals`: the `run-auto` scenario matches the T42 case (archived Change) and declares lint none.

## Impact

- Kernel: `kernel/src/shared/config/modules.ts` (schema, `toolGroup` helper), `kernel/src/shared/config/keys.ts` (key tree through the union), `kernel/src/graph/` (kinds carry their group and skip, `unsetToolsForKind` and `unsetToolsOf`, the refusal), `kernel/src/config/use-cases/set.ts`, `kernel/src/change/` (new, status, close), `kernel/src/part/use-cases/start.ts`, `kernel/src/dispatch/domain/checks.ts`, `kernel/src/review/`, `kernel/src/ctx/use-cases/parts.ts`, `kernel/src/evidence/use-cases/coverage.ts`, `kernel/src/shared/refusal/` (rule), output schemas under `schema/cli/` regenerated.
- Tests: E2E fixtures that open a Change gain tool settings; new unit and E2E tests per requirement.
- Content: `skills/stages/setup/SKILL.md`, `evals/suites/stages/cases/run.yaml`, user docs under `docs/guide/` for the settings form and the refusal.
- Out of scope: a `tools.build` state (no step runs it); a pipeline step for build; T51's `.bdk/` exclusion in `/bdk:setup` (#118, whichever lands second rebases).

## Decisions

Resolved from the "To resolve in the spec" list of #117; design.md gives the rationale.

1. **Settings form of declared none:** the scalar `none` (`tools.lint: none`, `bdk config set tools.lint none`). An empty list is invalid.
2. **A non-applying step is present and `skipped`**, the existing node state for a node that does not apply (`kernel-pipeline`, Node states), not absent and not done by policy.
3. **Refusing commands:** `bdk change new` (before the first write) and `bdk part start` (a setting removed after the Change opened). Every other command reads the unset group as today.
4. **`tests-full` and `lint-full` of a declared-none group are skipped** like the post-task steps, so `review` requires neither and the gate runner's package leaves the group out.
