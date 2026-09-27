# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T21. Tracks #53.

T20 made the Change a durable object with a ledger, but nothing yet says what the Change needs next: `next`, `explain`, `validate` and `done` answer `kernel/not-implemented`, `change new` and `change resume` return no `next`, and `change status` ships empty `nodes` and `gates`. Without the graph every stage skill would have to encode the stage order itself, which is exactly what Approach A removes. T22 (attempts, parts), T23 (evidence, post-task steps) and T24 (gate hooks) all hang their behaviour on graph nodes, so the engine has to exist first.

## What Changes

- **`pipeline/pipeline.yaml`** shipped with the plugin: the stage list (id and the stage command the user types) and the node list (id, kind, stage, `requires`, optional `profiles`, `kinds`, `if: features.<name>`, `budget`, `rules`, and for a gate `policy` and `opens`). Validated with a strict zod schema at load; a content test rejects unknown keys (`when:`), expressions beyond `if: features.<name>` and any path. The build generates `schema/pipeline.json` from the zod schema (as for settings and state), and the file carries a relative `yaml-language-server` modeline to it. The file has no path field at all, so it cannot reference anything outside the Change directory: paths belong to the kind classes.
- **Artifact kinds in TypeScript** under `kernel/src/graph/domain/kinds/`, one class per kind: `intent`, `design`, `architecture`, `design-part`, `design-index`, `plan-part`, `plan-verify`, `gate`, `execute-part`, `post-task-step`, `review`, `spec-delta`, `close`. Each class owns its files, its inputs for the hash, whether it applies to a Change (for example `architecture` skipped when `design.md` declares `architecture: false`), whether it expands into instances (`plan-part:01`, `design-part:02`, `execute-part:03`) and its baseline validator (schema, non-emptiness, size). Later tasks add checks to the same classes (S1 and P6 part checks in T22, citations in T23, delta semantics in T30).
- **Node states** `blocked | ready | done | stale | skipped`, derived on every call from the Change files and the ledger, never stored. A node is `done` only through `bdk done`, which runs the validator and writes a `transition` entry carrying the sha256 of the node's inputs (new field `input-hash`); a node whose current input hash differs from the recorded one is `stale` and not done (P2).
- **Gate kind** (T1, S8, R-9): `done` when the ledger holds a `transition` naming the gate with `source: user`, or `source: policy` while `policy.gates.<gate>` is `auto`, whose `at` is later than the moment the gate last became ready (the latest `done` transition among its requirements). A newer `done` upstream (a loop-back) therefore reopens the gate; an edit that nobody marks done again does not (the accepted risk "Gate binds to time, not content"). The kernel only recognises these entries; `hooks prompt-expansion` writes them in T24.
- **Graph variants**: profiles `tiny | small | large` and kinds `feature | bug` select nodes through node fields, not expressions. `tiny` has no design nodes, no design gate and no plan verification; `large` has `design-part` instances and `design-index` instead of `design`; `bug` has intent as reproduction, no design nodes and one plan part. The profile is the effective one from the ledger (T20); `bdk done design` on a `small` Change whose design was split into `design/parts/` writes a `decision` with `profile: large` and the nodes are recomputed; `done design` refuses a single `design.md` over 12 KB (T20 design D-11).
- **`graph` slice**: `next`, `explain`, `validate`, `done` implemented. `next` returns the first actionable node in pipeline order with its instruction and the gate status (the command to type and the pending `review: true` entries); `explain <artifact>` prints the `requires` chain with state, input hash and why; `validate` runs a validator with no side effect; `done` validates, records the hash, regenerates `plan/index.md` / `design/index.md` and is idempotent for an unchanged node.
- **Instruction builder**: the kind's template (new prompt keys `pipeline/<kind>`, default files `pipeline/<kind>.md` in the plugin, overridable per project), the node's rule sets resolved through `ctx`, and a bounded ledger summary (accepted decisions, open questions and blockers, pending review entries naming the node).
- **`change` slice**: `change new` and `change resume` return `next` (the stage command of the first actionable node); `change status` fills `nodes` and `gates` and derives `stage` through the pipeline.
- **Registered settings**: the `policy` config module with `policy.gates.design` and `policy.gates.review` (`manual | auto`, default `manual`), consumer `graph`, moved out of the planned keys.
- **Extensibility proof**: a test registers a fake kind (a TS class plus a YAML node in a test pipeline) and runs `next`, `explain`, `validate` and `done` on it with no change to the four commands or to any skill; T23 reuses it for the evidence primitives.
- **Contract amendments** (spec deltas plus `schema/` in the same PR): `transition` gains `input-hash`; the stage is the stage of the latest transition's target; `done` joins the writers of `decision` (the profile raise on a split design); the index gains an `input_hash` column (index schema version 3); `next`, `explain`, `validate`, `done`, `change new`, `change resume`, `change status` get their T21 behaviour and scenarios.

Resolutions of the plan's "To resolve in the spec" (details and rejected alternatives in design.md):

- **Schema of `pipeline.yaml` and `policy`**: `schema`, `stages` (`id`, `command`) and `nodes` (fields above); `policy` in `settings.yaml` holds only `gates.<gate>: manual | auto` in T21 (budgets, oscillation, escalation and checkpoint keys stay planned for T22, blocking categories and the observation cap for T23). A project cannot add nodes in T21: no settings key exists for it and no project has asked; recorded as an open question.
- **Per-node fields**: `id`, `kind`, `stage`, `requires`, `profiles`, `kinds`, `if`, `budget` (a T22 loop name whose value lives in `policy.budgets`), `rules` (rule categories for the instruction), and for gates `policy` and `opens`. Everything that needs logic (instances, skip conditions, validators, files) is kind code.
- **Format of the `next` instruction**: Markdown with a fixed skeleton: a heading naming the node, the kind template, "Write to" (paths), "Rules" (resolved rule sets), "Ledger" (at most 20 entry summaries, newest first, plus a count of the rest) and "When finished" (`bdk done <id>`).
- **Hash inputs per kind**: producer kinds hash their own files (`design.md`, `architecture.md`, one part file); `design-index` hashes all design parts; verdict kinds hash what they judge, not the verdict: `plan-verify` all plan parts, `review` the code tree of `HEAD` without `.bdk/`; `intent` hashes `change.md`; `spec-delta` hashes `spec-delta/`; `gate` has no hash (T1); `execute-part`, `post-task-step` and `close` hash what their owner tasks define and are marked done only by `part done` (T22), the post-task runner (T23) and `change close` (T30).

Inputs carried by citation: design "Approach A - Data-driven artifact graph", "Selected Approach: A with B's spine" (key boundaries "Human gate provenance", "`review: true` entries at the gate"), "Loop protection (A-drabina)" (states only), risks "Hidden cost: `pipeline.yaml` grows conditions", "Hidden cost: process documentation moves from readable skills into a graph nobody reads" and "Gate binds to time, not content (T1)"; decision register A-podejście, A-drabina, D3, S7, P2, T1, S8, S1; T02 decisions R-4, R-5, R-8, R-9 (`docs/V3-SKILL-INVENTORY.md`); T20 design D-11; specs `kernel-state`, `kernel-settings`, `kernel-cli` and its groups `graph` and `change`, `kernel-architecture`.

Out of scope:

- Writing gate transitions: `hooks prompt-expansion`, `source: user` and `source: policy` entries, the `run` skill walking auto gates (T24). T21 only recognises the entries.
- Attempts, budgets as counters, the escalation ladder, `part start | done | split`, the S1 and P6 part validators and the tiny guard (T22); T21 reads `budget` names only.
- Post-task step nodes, dispatch packages, evidence primitives and citation checks (T23); T21 ships the `post-task-step` kind and the fake-kind test T23 extends.
- Spec delta semantics and `change close` (T30); the stage skills that call `next` (T41).
- Project-defined pipeline nodes (open question in design.md).

## Capabilities

### New Capabilities

- `kernel-pipeline`: the artifact graph model: `pipeline.yaml` schema and its limits, artifact kinds and their inputs, node states and how they are derived, the gate rule, graph variants per profile and kind, the instruction format and the extensibility rule.

### Modified Capabilities

- `kernel-cli/graph`: `next`, `explain`, `validate`, `done` implemented by T21 with their behaviour, refusals and acceptance scenarios.
- `kernel-cli/change`: `change new` and `change resume` return `next`; `change status` fills `nodes` and `gates`.
- `kernel-state`: `transition` gains `input-hash`; `design.md` gains the optional `architecture` flag (R-5 skip for product-only Changes); stage derivation through the pipeline; `done` writes the `decision` that raises the profile on a split design; the index gains `input_hash` (version 3).
- `kernel-settings`: the `pipeline/*` prompt keys; `policy.gates.*` registered.
- `kernel-architecture`: the "new artifact kind" recipe names the kind registry, the pipeline file and the template location.

## Impact

- New code: `kernel/src/graph/` (commands, use-cases, domain with `kinds/`, render, schema, `config.ts`, tests), `pipeline/pipeline.yaml` and `pipeline/<kind>.md` templates at the plugin root.
- Changed code: `change` slice (`new`, `resume`, `status` ask the graph), `shared/store` (transition `input-hash`, index column and version, stage derivation taking a stage resolver), `shared/git` (code tree hash), `shared/config/known.ts` (planned keys), `ctx/index.ts` (exports rule resolution for the instruction builder), `registrations.ts`, `kernel/scripts/export-schemas.ts`.
- Contract: `schema/pipeline.json` (new, generated from zod), `schema/cli/commands.json` (graph records), `schema/cli/output/{next,explain,validate,done}.json`, `schema/state/entry.json`, `schema/settings` JSON Schema, the state fixture.
- Bundle `dist/bdk.mjs` rebuilt; `pipeline/` added to the plugin files. No new runtime dependency.
