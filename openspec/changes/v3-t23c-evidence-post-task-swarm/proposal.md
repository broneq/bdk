# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T23 (part C of three). Tracks #55.

Parts A and B made the package go in and the report come out, but nothing yet proves that a task's code was checked: `evidence record` and `evidence check` answer `input/unknown-command`, `attempt close` declares `policy/stale-evidence` and `policy/missing-citation` without emitting them, `attempt close ok` returns `next.action: post-task-steps` with nothing behind it, and the `post-task-step` kind has no nodes. Part C adds the evidence primitives (T4, P5), the post-task steps as graph nodes, the swarm skill that T41 `execute` and T42 `cr` call, and the archive prune, so T41 has a complete execution loop to drive. The user took five decisions in a Lavish review on 2026-09-28 (`.lavish/v3-t23c-questions.html`): one Change for all of C; steps after every task with one node per part, done from the latest fresh evidence; steps inside the task's ticket with `attempt close ok` requiring fresh cited evidence; text evidence up to 64 KB committed, the rest in `.machine`; default file-class lists that projects extend by appending.

## What Changes

- `bdk evidence record <kind> <file>... --ticket <ticket> [--verdict] [--cite]` is implemented: the kernel hashes the files, copies a UTF-8 text file without NUL bytes of at most `policy.evidence.max-committed-bytes` into `changes/<id>/evidence/` (`stored: committed`) and keeps any other file under `.bdk/.machine/evidence/` (`stored: machine`), stamps the tree hash of the ticket's target and the per-file tree it hashed, validates every citation (`file#/json/pointer`, `file:line`, `file:line=text`; T23-D8) and refuses a `pass` without one that resolves. A project kind is any kebab-case name.
- `bdk evidence check <target|evidence-id>` is implemented: a manifest is fresh when its `tree-hash` equals the current tree hash of its target; the output names the files changed since. The argument widens from a task to any ticket target.
- Tree hash (T23-D7, D16): sha256 over the sorted paths and bytes of the `Files:` of every task in the target's scope (a task's whole part, a part, or every part for the Change) minus non-executable files, plus the repository files matching the build-config globs; build-config wins. One function serves `evidence record`, `evidence check`, `attempt close` and the step nodes.
- `policy.evidence` is registered (consumer `evidence`): `non-executable` and `build-config` glob lists whose layers append to the defaults, and `max-committed-bytes` (65 536). `kernel-settings`, Merge gains the append-merged glob list.
- Post-task steps become three kinds and nodes, `simplify`, `tests-scoped` and `lint`, sharing the `post-task-step` base: one instance per plan part, placed after `execute` in `pipeline.yaml` (simplify, then tests-scoped and lint), required by `review`. A step node is done from evidence, not from a transition: the latest manifest of its kind covering the part is fresh and says `pass` or `not-run`. The pipeline engine pairs the instances of two per-plan-part collections by number.
- **BREAKING (contract only):** the steps run inside the ticket of the task (user choice). `dispatch build` keeps one package per role and ticket, and the attempt record's new `package` field names the ticket's active package, through which every ticket-keyed agent command finds the role. `attempt close ok` of a ticket that holds an `implementer` package records the `simplify` manifest from the stored `simplifier` report and refuses a missing or failing step (`policy/missing-evidence`, new), a stale one (`policy/stale-evidence`) and a `pass` without a resolving citation (`policy/missing-citation`). `next.action` after `ok` becomes `commit` instead of `post-task-steps`.
- New role `simplifier` on the `worker` adapter (realises T23-D9's simplify package); the role count goes from seven to eight. The `runner` package gains a `Checks` section with the configured `tools.test` and `tools.lint` commands for the target's executable files and the exact `evidence record` line per step, and the runner contract records every check it runs.
- `bdk log list --since-ticket-start <ticket>` lists the entries at or after the ticket's `opened-at`.
- Swarm skill `skills/swarm/SKILL.md` (not user-invocable): principles only, host notes in `references/hosts/claude-code.md`; at most `execution.concurrency` dispatches at once; the orchestrator's single resume for a missing or refused report (T23-D35). `execution.concurrency` is registered with consumer `ctx`, which puts it in the swarm skill's context through a new `concurrency` manifest part.
- Archive prune (V1-9, T23-D12): a `shared/store` function replaces the bodies of `dispatch/` and `reports/` with one hash index per directory (`pruned.md`: path, sha256, bytes); T30's `change close` calls it unless `archive.keep-evidence`. The key's owner moves from T23 to T30, the task that lands its consumer.
- E2E acceptance with a fake project evidence kind exercising the manifest, `not-run` and citations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli/evidence`: `evidence record` and `evidence check` specified in full (storage, tree hash, citations, dedupe, project kinds, `<target>` argument).
- `kernel-cli/attempt`: `attempt open` returns the ticket's post-task steps; `attempt close ok` records the simplify evidence and runs the evidence checks; `next.action: commit`.
- `kernel-cli/dispatch`: one package per role and ticket, the `package` stamp, the `simplifier` role and the runner's `Checks` section; `dispatch show <ticket>` shows the active package.
- `kernel-cli/log`: `log list --since-ticket-start`; `log ingest` and `log add` resolve the role through the active package.
- `kernel-cli/rules`: `rules show --ticket` resolves the role through the active package; role-to-category map gains `simplifier`.
- `kernel-cli/ctx`: the `concurrency` part of `ctx skill`.
- `kernel-cli`: rule table (`policy/missing-evidence`).
- `kernel-loops`: Escalation ladder (`ok` gives `commit`).
- `kernel-pipeline`: Artifact kinds (three step kinds, done through evidence, instance pairing), Node states (evidence-derived done and stale), Pipeline file (the step nodes).
- `kernel-settings`: Merge (append-merged glob lists), `policy.evidence`, `execution.concurrency` consumer `ctx`, `archive.keep-evidence` owner T30.
- `kernel-state`: Change directory layout (capture names, `pruned.md`), Evidence manifest (`tree`), Attempt record (`package`), Write map, Pruned index document.
- `role-contracts`: eight roles with `simplifier`; the runner records evidence; the swarm skill carries out the single resume.
- `kernel-architecture`: matrix rows (`graph` and `attempt` import `evidence`, `attempt` imports `graph`, `dispatch` imports `ctx`); T23 part C registration scenario.

## Impact

- Kernel: new `evidence` slice (record, check, tree hash, file-class filter, citation validator, `policy.evidence`); `graph` step kinds, `evidence` done-by and instance pairing; `attempt` open steps, close checks and simplify evidence; `dispatch` package retention, `package` stamp, runner `Checks` section, `simplifier`; `log list --since-ticket-start`; ticket role resolution through `shared/store`; prune function and `pruned` document kind in `shared/store`; `ctx` `concurrency` part and `execution` module; `pipeline/pipeline.yaml`; command index, output schemas, refusal catalogue, `schema/state/`, `dist/bdk.mjs` rebuilt.
- Content: `skills/roles/simplifier/SKILL.md`, runner contract, `skills/swarm/` with host notes, README rows, `.claude/rules/verification-scoping.md` (the kernel filter is one more copy of the file-class partition).
- Tests: unit and E2E per acceptance signal C (manifest older than the tree hash rejected, PASS without citations rejected, a verdict for an older part hash is stale so `plan-verify` is not done, fake kind with manifest, `not-run` and citations, a non-executable change keeps evidence fresh), step node states, close refusals, the swarm eval and content test.
- Out of scope: `change close` itself and the call of the prune (T30); stage skills that call the swarm (T41 `execute`, T42 `cr`); UI evidence (`ui-verify`, a Change after v3); guard hooks (T24).
