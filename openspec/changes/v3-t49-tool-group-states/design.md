# Design

## Context

- `tools.test` and `tools.lint` are lists of tool entries with the schema default `[]` (`kernel/src/shared/config/modules.ts`). After validation an unset group and a group a layer set to `[]` are the same value.
- The merge (`kernel-settings`, Merge) merges a list of mappings with `id` by id and replaces every other value whole. `[]` is not an id list, so a layer's `[]` replaces the lower layers' entries.
- The pipeline always holds `tests-scoped` and `lint` (kinds `feature`, `bug`) and `tests-full` and `lint-full` (every kind) (`pipeline/pipeline.yaml`). A node that does not apply already has a state: `skipped`, with `why`, and a requirement on it is satisfied (`kernel-pipeline`, Node states). The engine asks a kind's `skip(view)` for kind-level reasons (`kernel/src/graph/domain/engine.ts`).
- The runner's `Checks` come from the graph's non-skipped post-task steps (`postTaskSteps`, `kernel/src/graph/use-cases/steps.ts`), and so do the steps `attempt close` checks. The gate runner of a review round gets `fullChecksText` over both groups without asking the graph.
- `/bdk:setup` reads the groups through `bdk ctx skill setup`, whose `tools` part prints "none configured" for an empty group.

## Goals / Non-Goals

**Goals:**

- Three distinguishable states per group, each with one spelling, surviving the layer merge.
- A declared-none group produces no node to run, no `not-run` manifest and no budget use.
- An unset group stops the Change before its first step, with the commands that fix it.
- A Change without tests is visible as such wherever a human judges it: status, the review report and the PR summary.

**Non-Goals:**

- A state for `tools.build`: no pipeline node runs it.
- Choosing commands for the user or detecting a linter in the kernel; that is `/bdk:setup`'s job.
- Changing the not-run budget or what `not-run` means for a configured group whose command could not run.

## Decisions

### D1. Declared none is the scalar `none`; an empty list is invalid

The schema of `tools.test` and `tools.lint` becomes `none | [entry, ...]` (at least one entry), with no default. Unset is the absence of the key in every layer. `bdk config set tools.lint none` writes it, and `bdk config set tools.lint.eslint '{...}'` over a `none` replaces it with a list, through the existing merge rules: a scalar replaces whole, an id list over a non-list starts from empty.

- _`[]` as declared none_ lost: it is indistinguishable from the default once validated, it reads like "not filled in yet", and a layer's `[]` silently erases the lower layers' entries.
- _A separate key (`tools.unused: [lint]`)_ lost: two keys can contradict each other (`lint` configured and listed as unused), which needs a cross-key rule and a precedence.
- _`false` or `null`_ lost: `null` is "no value" in YAML and in the merge, and `false` on a list key reads as a switch. `none` says what it means.

An empty list is refused by `bdk config check` (`policy/config-invalid`), whose message names `none`, so a project migrating from the default `[]` is told the one spelling. The key tree of the registry (`kernel/src/shared/config/keys.ts`) looks through the union to the list, so `tools.test.<id>.<field>` stays addressable.

### D2. A declared-none step node is `skipped`

The four kinds carry their group (`test` for `tests-scoped` and `tests-full`, `lint` for `lint` and `lint-full`). Their `skip(view)` answers `tools.<group> is none` when the view's state of that group is `none`. The engine then makes the node `skipped` and drops it from every `requires` (`kernel-pipeline`, Node states), so:

- `postTaskSteps` leaves the step out: the runner package does not list it and `attempt close` does not ask for its evidence;
- `review` does not wait for a skipped `tests-full` or `lint-full`;
- the gate runner's package leaves out the section of a skipped change-level check (`dispatch build` asks the graph which apply).

- _The node absent from the graph_ lost: `change status` lists every node, skipped ones included, and is the place a human sees that lint does not run; an absent node also turns a `requires` on it into "does not exist".
- _Present and done by policy_ lost: `done` means its evidence holds. A done node without evidence would need a fake manifest or a second meaning of `done`, and `bdk done` of the node would have to explain it.

### D3. `change new` and `part start` refuse an unset group (`policy/tools-unset`)

`change new` computes, before any write, the groups whose nodes apply to the Change kind (pipeline nodes of a grouped kind whose `kinds` include it). Any unset one is refused with exit 2:

```json
{
  "refused": true,
  "rule": "policy/tools-unset",
  "why": "tools.lint is unset: the Change runs lint and lint-full; configure the project's lint commands or declare that it has none",
  "instead": [
    "bdk config set tools.lint.<id> '{tier: lint, command: <command>}'",
    "bdk config set tools.lint none",
    "/bdk:setup"
  ]
}
```

`part start` refuses the same way when a non-skipped node of the Change's graph belongs to an unset group, which covers a setting removed after the Change opened. When the settings do not validate, `change new` skips the check and keeps today's behaviour (open the Change, `bdk next` answers the settings refusal).

- _Refuse at `bdk next` or at every Change-scoped command_ lost: it blocks reading a Change (`status`, `log`) for a setting only execution needs.
- _Refuse only at `part start`_ lost: the user learns it after design and plan, the stages it does not concern. `change new` is where the project's setup is checked.
- _A `bdk doctor` finding only_ lost: doctor is not on the stage path, so the run still fails late.
- A new rule instead of `policy/config-invalid`: the settings are valid; they lack a decision. A stage skill reacts differently (send the user to `/bdk:setup`).

### D4. The visible warning

- `change status` returns `tools: {test, lint}` with `configured`, `none` or `unset`. The text form prints `tools: lint not used (tools.lint is none)` and, for tests, `warning: no test tool (tools.test is none): this Change runs no test`.
- `review render` puts `Tests: not used (tools.test is none): this Change ran no test` in the Gate section as a warning (HTML class `warn`), and `Lint: not used (tools.lint is none)` as a plain line.
- `change close` returns `toolsNotUsed` (group names, sorted) and its summary gains `### Checks` with one line per group: the PR reader sees that no test or lint ran.

Tests get the stronger wording because a Change without any test is a risk to the reviewer; a missing linter is a style gap.

### D5. Fixtures and the eval case

E2E fixtures that open a Change or start a part set both groups (most to `none`, the evidence and dispatch fixtures to their existing entries). The stage cases `run-auto` and `run-manual` declare `tools.lint none` instead of configuring eslint; the acceptance signal is a `run-auto` probe that archives the Change with no `lint` manifest.

## Risks / Trade-offs

- [A project that relied on the default `[]` now gets `policy/tools-unset` at `change new`] -> v3 is unreleased; the refusal names the fix and `/bdk:setup` writes it. The doc page of the settings explains the three states.
- [A union schema confuses tools that walk the key tree] -> the key tree looks through the union to the list; the settings JSON Schema renders `oneOf` with the `none` string, which editors accept.
- [`none` for tests hides a forgotten test setup] -> it is an explicit, committed choice, and status, the review report and the PR summary each say the Change ran no test.

## Open Questions

None.
