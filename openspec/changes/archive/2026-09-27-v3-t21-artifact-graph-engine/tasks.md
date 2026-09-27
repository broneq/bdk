# Tasks

## 1. Start

- [x] 1.1 Confirm issue #53's card is "In progress" on the project board (`gh project item-list 1 --owner broneq --format json`)
- [x] 1.2 Record the T21 resolutions in `docs/V3-IMPLEMENTATION-PLAN.md` (design D-13): T21 section points each "To resolve in the spec" item to this Change; T22 row (`budget` names on nodes, `execute-part` done through `part done`, the shared `policy` module question), T23 row (`post-task-step` kind, fake-kind test to extend, verdict kinds hash what they judge), T24 row (the gate entry the kernel recognises: `gate`, `source`, ready time compared with `>=`), T41 row (`next` output, `architecture: false` in `design.md`, `done design` raising the profile on a split); verify every item points to this Change

## 2. Contract: index, catalogue, state and output schemas

- [x] 2.1 Update `schema/cli/commands.json`: `policy/invalid-transition` on `done`; update `shared/refusal` catalogue data if it carries emitters; sync this Change's deltas into the main specs (`openspec sync` or by hand, as T20 did) so the contract tests read the amended text; verify `pnpm test:contract` passes
- [x] 2.2 Write failing state tests: a `transition` with `input-hash` validates, a malformed hash fails naming `input-hash`; `design.md` with `architecture: false` validates and with `architecture: "no"` fails; the state fixture gains both fields
- [x] 2.3 Add `input-hash` to `transition` and `architecture` to the design document in `shared/store/state/`, regenerate `schema/state/`, extend the state fixture; verify 2.2 and `pnpm test:contract` pass

## 3. shared/store and shared/git

- [x] 3.1 Write failing unit tests: index schema version 3 rebuilds a version 2 index; `input_hash` indexed and returned on entry rows as `inputHash` (the engine reads the transitions through `listEntries`); `stageOf(entries, resolver)` maps `plan-part:02` to `plan`, a stage id to itself and gives `intent` without transitions; `codeTreeHash` is equal for equal committed trees, ignores `.bdk/` and uncommitted edits, differs after a code commit, and refuses `runtime/git-missing` without git
- [x] 3.2 Implement the index column and version, the `inputHash` row field, the `stageOf` resolver parameter (updating its T20 callers) and `shared/git` `codeTreeHash`; verify 3.1 and the existing store, change and log tests pass

## 4. graph: pipeline file and its content test

- [x] 4.1 Write failing tests for the pipeline schema (`graph/tests/pipeline.test.ts`) and the content test (`kernel/tests/contract/pipeline.test.ts`): unknown key `when:` rejected naming the key; `if:` other than `features.<name>` rejected; unknown feature, unknown kind, unknown stage, dangling and cyclic `requires`, duplicate id, gate without `policy` or `opens`, `policy` not a declared `policy.gates` key, `budget` outside the loop list, `rules` naming an undeclared category all rejected; the shipped file validates; the committed `schema/pipeline.json` accepts the shipped file and rejects the `when:` fixture, and the shipped file's first line is the relative modeline
- [x] 4.2 Write `pipeline/pipeline.yaml` with the stages and the node list of design D-6; implement `graph/schema/pipeline.ts` and the loader (plugin root, once per process, crash on an invalid shipped file); add `schema/pipeline.json` generation to `kernel/scripts/export-schemas.ts` and the modeline `# yaml-language-server: $schema=../schema/pipeline.json` to the YAML; verify 4.1 passes and `pnpm build` then `git diff --exit-code schema/` is clean

## 5. graph: kinds and the state engine

- [x] 5.1 Write failing unit tests for the kind registry and each kind (`graph/tests/kinds.test.ts`): the thirteen kinds are registered; files, hash inputs (path and bytes, rename changes the hash), baseline validator (missing, empty, schema-invalid, `design.md` over 12 KB with check `size`), `architecture` applicability (`tiny`, `architecture: false`), `spec-delta` applicability (`spec-impact`), instances of `design-part`, `plan-part`, `execute-part` (with `depends-on` edges), verdict kinds needing a `report` entry with `status: done | done-with-concerns` and no live blocker, `doneBy` of `intent`, `execute-part`, `post-task-step`, `close`
- [x] 5.2 Write failing unit tests for the engine (`graph/tests/engine.test.ts`) on entry and file fixtures: states `done`, `stale` (both hashes), `ready`, `blocked` (`why`), `skipped` (profile, kind, `if`, kind rule); requirement on a skipped node satisfied; collection with no instance actionable, done only with all instances done; sealing (a stale node behind a done gate is not returned and does not reopen it); pipeline order for `next`; every variant of `kernel-pipeline` Graph variants (tiny, small, large, bug, product-only)
- [x] 5.3 Write failing unit tests for the gate rule (`graph/tests/gate.test.ts`): user entry at or after the ready time passes; older entry does not; loop-back moves the ready time; `policy` entry counts only under `auto`; transitions with another `source` and entries of other types never count; `pending` lists live `review: true` entries newest first; `passedBy`; `command` from `opens`
- [x] 5.4 Implement `graph/domain/kinds/` (registry and thirteen classes), `graph/domain/` state engine and gate rule as pure functions over files and entry facts; verify 5.1-5.3 pass

## 6. graph: settings and the instruction builder

- [x] 6.1 Write failing tests: `policy.gates.design` and `policy.gates.review` resolve to `manual` by default and accept `auto`; `policy.budgets.verifier` still answers "lands with T22"; one literal prompt key `pipeline/<kind>` per registered kind with its plugin default, `.bdk/prompts/pipeline/desing.md` answers `policy/unknown-config-key`; the instruction skeleton (heading, template with the four placeholders replaced, "Write to", "Rules" resolved through `ctx`, "Ledger" capped at 20 with the omitted count, "When finished"), byte-identical on a second run, project `mode: extends` appended
- [x] 6.2 Implement `graph/config.ts` (the `policy` module, prompt keys from the registry), remove T21's keys from `PLANNED_KEYS`, export the rule resolution from `ctx/index.ts`, write the thirteen `pipeline/<kind>.md` templates, implement `graph/use-cases/instruction.ts`; register the module and keys in the composition root; verify 6.1 and the `kernel-settings` contract tests pass

## 7. graph: the four commands

- [x] 7.1 Write failing unit tests in `graph/tests/` for `next` (artifact, instruction, gates, `waiting: gate | user | nothing`, STOP block without an active Change, exit 0), `explain` (chain order, each node once, stale hashes, gate evidence, `skipped` for a node outside the variant, `input/not-found`), `validate` (checks and hash, default artifact, no write, text mode exit 2, `input/not-found` when nothing is actionable) and `done` (`policy/not-ready`, `policy/validation-failed`, `policy/gate-not-ready`, `policy/invalid-transition` for the four other-command kinds, idempotent re-run, collection batch stopping at the first failure, index regeneration, the profile raise on a split design, the entry's fields)
- [x] 7.2 Implement `graph/` commands, use cases, render and zod output schemas replacing the four stubs; add the schema lines to `kernel/scripts/export-schemas.ts`; register the slice; verify 7.1 passes and `pnpm build` regenerates `schema/cli/output/` without drift from the committed shapes other than the documented ones
- [x] 7.3 Write `graph/tests/graph.e2e.ts` through the bundle: one case per exit code and per declared rule of the four records, outputs validated against their schemas; `policy/part-too-large`, `policy/part-too-many-tasks`, `policy/do-not-touch-overlap`, `policy/placeholder` (T22), `policy/spec-invalid` (T30) and `policy/missing-citation` (T23) are noted in the file as their owner tasks' cases
- [x] 7.4 Write the extensibility test (`graph/tests/extensibility.test.ts`): a fake kind plus a test pipeline node after `intent`; `next`, `explain`, `validate`, `done` and `change status` work on it with production command code unchanged; verify it passes
- [x] 7.5 Run `/docs-sync` for `next`, `explain`, `validate`, `done`, `pipeline.yaml`, `policy.gates` and the `pipeline/<kind>` prompt keys; update the `docs/guide/` pages on the pipeline and the kernel commands (`concepts/plan-pipeline.md`, the configuration reference); verify `pnpm docs:build` passes

## 8. change slice on the graph

- [x] 8.1 Write failing tests in `change/tests/`: `change new` returns `next` (`/bdk:design` for small and large features, `/bdk:plan` for tiny and bug); `change resume` returns `next`; `change status` fills `nodes` (every node in order, instances, skipped, `why`, hashes) and `gates` (`ready`, `done`, `passedBy`, `command`, pending) and derives `stage` through the pipeline; text mode stays within 100 lines on 1 000 entries and 8 plan parts, collapsing done instances; `passedBy: policy` shown in text
- [x] 8.2 Implement the three use cases through `graph/index.ts`; verify 8.1 and the existing `change` unit and E2E tests pass; update the `docs/guide/` page for `change status` in the same step

## 9. Acceptance

- [x] 9.1 Write `graph/tests/acceptance.e2e.ts` on repository fixtures through the bundle, one case per item of the T21 acceptance signal: new `small` Change -> `next` returns `design`; design and architecture done plus a fixture `transition source: user` -> `next` returns `plan`; a `log add` entry faking approval does not open the gate; a loop-back (`done design` with a new hash) needs a newer user entry; `explain plan-verify` prints the chain; the pipeline fixture with `when:` is rejected by the content test; `tiny` has no `design` node; `large` has `design-part` nodes and `next` returns `architecture` before `plan`; `bug` goes from `intent` to `plan` (kind `plan-part`); `policy.gates.design: auto` passes the gate with a `source: policy` entry and `manual` does not; plus `next` p95 under 150 ms on a fixture with 8 plan parts and 1 000 entries
- [x] 9.2 Run `pnpm build` then `git diff --exit-code dist/ schema/`; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`; `pnpm test:unit` (coverage thresholds), `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `pnpm docs:build`; verify all pass
- [x] 9.3 Run `openspec validate v3-t21-artifact-graph-engine --strict`; verify it is valid
