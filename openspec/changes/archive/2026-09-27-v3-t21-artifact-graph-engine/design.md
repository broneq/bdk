# Design

## Context

See proposal.md - Why. The state this Change builds on:

- T20 shipped the Change directory, the ledger writer (`log` slice, `appendEntry`), the SQLite index with `to_stage` and `gate` columns, derived state in `shared/store/state/derived.ts` (stage from the latest `transition`, effective profile, parked) and the `change` slice. `next`, `explain`, `validate` and `done` are registered in `schema/cli/commands.json` with owner T21 and answer `kernel/not-implemented`; their output schemas (`next.json`, `explain.json`, `validate.json`, `done.json`) and the `nodes` / `gates` shapes of `change-status.json` already exist.
- T12 shipped layered settings with config modules per slice (`defineConfigModule`), prompt keys with plugin default files (`definePromptKey`, `rules/*`, `fragments/*`), and `PLANNED_KEYS` naming `policy.gates.design` and `policy.gates.review` as T21's.
- T13 shipped `ctx`, which resolves rule sets and fragments for skills; the `kernel-architecture` dependency matrix already allows `graph -> log, ctx` and `change -> graph`, and `hooks -> graph` for T24.
- `kernel-state` defines `transition` (`to`, `gate`, `session`, `command`, `skip-verify`), the design and plan part documents and the generated indexes; `kernel-state` Write map already names `done` as a writer of `transition`, `plan/index.md` and `design/index.md`.

Constraints: the NFR "Latency" budget of `hooks prompt-expansion` (< 150 ms p95, T24) runs `next`; S1 caps a CLI state answer at 100 lines; the risk "`pipeline.yaml` grows conditions" fixes the YAML boundary; T1 fixes that a gate binds to time, not content.

## Goals / Non-Goals

**Goals:**

- The stage order lives in one data file; every node state is derivable from committed files plus the ledger, on any clone, without a cache that matters.
- `done` is unforgeable by file existence: a node is done only with a recorded hash of what was validated.
- Gates recognise provenance (`source: user`, or `policy` under `auto`) and timing only.
- A new kind is one class plus one YAML node (proven by a test T23 reuses).

**Non-Goals:**

- Writing any gate transition (T24), counting attempts against `budget` (T22), the rich validators of parts, evidence and deltas (T22, T23, T30), the stage skills (T41).
- Project-defined nodes (Open Questions).

## Decisions

### D-1 `pipeline/pipeline.yaml` read at run time from the plugin root

The graph lives in `pipeline/pipeline.yaml` next to the kind templates `pipeline/<kind>.md`, read through the same plugin-root resolution `ctx` uses for `rules/*.md` (`pluginRootOf(import.meta.url)`), parsed with `yaml` and a strict zod schema (`graph/schema/pipeline.ts`). Graph commands load it once per process. `kernel/scripts/export-schemas.ts` generates `schema/pipeline.json` from the same zod schema (T12 design D-10: zod is the source, JSON Schema is generated and committed), and the YAML's first line is `# yaml-language-server: $schema=../schema/pipeline.json`. The modeline is relative, unlike the versioned URL of `settings.yaml`, because the pipeline file only ever lives in the plugin checkout next to its schema, so the editor validates against the schema of the same revision without network access.

Alternatives: embedding the YAML in `dist/bdk.mjs` through an esbuild text loader (one file less at run time, but the templates next to it are prompt files that must stay files for project overrides, and a data edit would force a bundle rebuild); a TypeScript constant (loses the "process as data" promise of Approach A and the content test on the YAML itself); a settings key (the project would own the stage order, which D3 does not ask for).

### D-2 Kinds are classes in a registry; YAML carries no path

`graph/domain/kinds/` holds one class per kind implementing the `Kind` interface over a read-only `ChangeView` of the Change: `writes(view, nn?)` (the files the kind writes, patterns before an instance exists), `inputs(view, nn?)` (the files whose bytes form the hash, the code tree for `review`, or none), the optional `skip?(view)` (skip logic that needs content, such as `architecture: false` or `spec-impact`; kinds without it always apply), the optional `instances?(view)` (for `design-part`, `plan-part`, `execute-part`), `validate(view, target)` returning checks, and `doneBy` (`done`, `construction`, `gate`, or the owning command). The template key is `pipeline/<kind name>`. `graph/domain/kinds/index.ts` is the registry; the use cases take it as a dependency, so a test can add a fake kind (`kernel-pipeline`, Kind extensibility) without touching production code.

YAML has no path field at all. That turns the risk row "no references outside the Change directory" from a validation rule into an impossibility, and keeps all file knowledge in tested code.

Alternatives: a generic kind configured by YAML (`file: design.md`, `schema: design`): every new behaviour then grows a YAML key, which is how the file becomes a language; one kind per node id (the three gates or collections would duplicate code).

### D-3 Done state and hash live in the ledger as `transition` entries

`done` appends a `transition` entry through `log`'s `appendEntry` with `to: <node>`, `source: kernel`, `refs: [<node>, <files>]` and the new optional field `input-hash`. The node's state is recomputed from the latest such entry on every read. The index gains an `input_hash` column (schema version 3; a mismatch rebuilds, as T20 D-3 decided), so the latest done entry per node is one query.

Alternatives: a `done` marker file per node (a new mutable path in the layout, conflicts on merge when two branches re-done a node); the hash in `.bdk/.machine/` (lost on a fresh clone, so every node would look undone there); the hash in the artifact's own frontmatter (written by the model through host file tools, so forgeable, which is the exact OpenSpec `existsSync` risk).

### D-4 Hash inputs: what the validator judged, never the upstream chain

| Kind                                      | Inputs                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `intent`                                  | `change.md`                                                             |
| `design`, `architecture`                  | the own file                                                            |
| `design-part:<nn>`, `plan-part:<nn>`      | the part file                                                           |
| `design-index`                            | every design part                                                       |
| `plan-verify`                             | every plan part (P2: a verdict for another part hash is stale)          |
| `review`                                  | the code tree of `HEAD` without `.bdk/` (`git ls-tree -r HEAD`, sorted) |
| `spec-delta`                              | every file of `spec-delta/`                                             |
| `gate`                                    | none (T1)                                                               |
| `execute-part`, `post-task-step`, `close` | defined by T22, T23, T30                                                |

A hash is sha256 over `path NUL bytes NUL` per file in path order. The verdict report of `plan-verify` and `review` is read by the validator but is not an input: a new report means a new `done`, not a stale node. `review` uses the committed tree so ledger writes and uncommitted edits do not flap it; `shared/git` gains `codeTreeHash(workTree)`, computed only when the review node has a done entry to compare with, so `next` spawns git at most once and only late in a Change.

Alternatives: a Merkle chain (each node hashes its requirements' hashes): an upstream edit would cascade through a passed gate, which T1 and the accepted risk "Gate binds to time, not content" rule out; hashing the working tree for `review` (every uncommitted edit, including the ledger, would stale it).

### D-5 Gate: ready time from `done` entries, plus sealing

A gate's ready time is the latest `at` among the done entries that currently satisfy its requirements. The gate is done when a `transition` with `gate: <id>` and an accepted `source` (`user`; `policy` only while `policy.gates.<gate>` resolves to `auto`) is not earlier than that time. Consequences, each an acceptance item: a fixture entry after `done design` passes the gate; a `log add` entry never does (`log add` cannot write `transition` at all, T20); a loop-back (a new `done` upstream with a new hash) moves the ready time past the old entry and needs a new one; an early entry typed before the gate was ready never counts.

Sealing: a node that a done gate transitively requires is sealed; `next` skips it and its staleness does not reopen the gate. Without sealing, any edit of `design.md` after `/bdk:plan` would make `design` stale, `next` would send the model back to design, and the gate would reopen, turning T1's accepted risk into friction the user rejected on page 08. With sealing, the edit stays visible (`explain` and `change status` show `stale` with both hashes) and a deliberate loop-back remains possible through `bdk done design`.

Comparison uses `>=` on second-resolution timestamps: `hooks prompt-expansion` calls `next` before writing (T24), so a user entry in the same second as the last `done` was written after it.

Alternatives: a hash in the gate (rejected by T1, P2); a gate that stays done forever (a loop-back could never reopen it, failing the acceptance signal); ordering by entry id (ids are random, `kernel-state` Identifiers).

### D-6 Variants through node fields, content rules in kinds

`profiles` and `kinds` on a node are closed lists, not expressions; the only condition is `if: features.<name>`, checked against the declared `features` keys. Two skips need content and so live in kind code: `architecture` (`design.md` declares `architecture: false`, a new optional `kernel-state` field) and `spec-delta` (some plan part declares `spec-impact`). A requirement on a skipped node is satisfied, so `gate:design` can list `design`, `design-index` and `architecture` and work for every variant.

The shipped node list (pipeline order): `intent`; `design` (small, feature); `design-parts` and `design-index` (large, feature); `architecture` (small and large, feature); `gate:design` (small and large, feature; `policy: design`, `opens: plan`); `plan` (plan parts, all; `rules: [code-quality, architecture, test-quality]`); `plan-verify` (small and large; `budget: verifier`); `execute` (execute parts; `budget: task-redispatch`); `spec-delta`; `review` (`budget: review-fix`); `gate:review` (`policy: review`, `opens: close`); `close`. Post-task step nodes are added by T23.

Alternatives: one pipeline file per profile (three copies of most nodes, drift); `if: profile == tiny` (the first expression; the risk row forbids it).

### D-7 Collections and instance ids

A node whose kind has instances names the collection (`plan`, `design-parts`, `execute`); its instances are `<kind>:<nn>` from the part files (`plan-part:01`) and inherit the collection's requirements, plus kind-specific edges (`execute-part` follows `depends-on`). With no instance the collection itself is the actionable node, which is why `next` on a Change past `gate:design` returns `plan`. The collection is done when it has instances and all are done. `done plan` marks every ready part in id order as one call; `done plan-part:02` marks one.

Alternative: a separate "plan written" node (a second done signal for the same fact, and the kernel still could not know the count of parts in advance).

### D-8 A split design raises the profile inside `done design`

When `done design` finds `design/parts/` holding parts and no `design.md` on a `small` Change, it writes a `decision` with `profile: large` (`source: kernel`) and answers with the first design part as `next`. The kernel sees the split from the files, so the skill cannot forget the profile raise. `done` joins the writers of `decision` in the write map.

Alternatives: the `design` skill calls `change resume <id> --profile large` (already raises profiles, but resume is the rebind and unpark verb, and a skill that forgets it leaves a `small` graph over a split design); a new `change profile` command (contract growth for a single kernel-detectable case).

### D-9 Instruction builder: kind template, rules through `ctx`, capped ledger summary

`graph/use-cases/instruction.ts` composes the skeleton of `kernel-pipeline`, Instruction. Templates are prompt values with one literal key per registered kind (`pipeline/design`, ...), declared by the graph's `config.ts` from the kind registry, so a project override for a non-kind name is `policy/unknown-config-key` and the fake kind of the extensibility test declares its own key. Rule sets are resolved by a function `ctx/index.ts` exports (the same resolution `ctx skill` uses for `rules/<category>`), not by re-reading prompt files in `graph`. The ledger section reads the index: accepted decisions, live questions and blockers, live `review: true` entries whose refs name the node or its files; 20 lines at most, newest first, then "N more: bdk log list". Placeholders are a fixed set (`{change}`, `{node}`, `{profile}`, `{paths}`), replaced literally; no template language.

Alternatives: embedding `ctx skill <stage>` output (duplicates what the skill's own `!` block already injects); a template engine (Mustache or similar adds a dependency and conditionals, the same drift the YAML boundary forbids).

### D-10 `done` refuses kinds that another command completes

`intent` is done by construction; `execute-part`, `post-task-step` and `close` are done by `part done` (T22), the post-task runner (T23) and `change close` (T30), each writing its own `transition`. `done` on them answers `policy/invalid-transition` with that command in `instead`. `policy/validation-failed` would tell the caller to fix a file that is fine. The rule is added to `done` in the index and to the catalogue's "Emitted by" column.

### D-11 The `policy` config module starts with `gates`

`graph/config.ts` registers the `policy` module (consumer `graph`, owner T21) with `gates.design` and `gates.review`, both `manual | auto`, default `manual`, and T21's two keys leave `PLANNED_KEYS`. The planned `policy.budgets.*`, `policy.oscillation.*`, `policy.escalation.*`, `policy.checkpoint.*` (T22), `policy.verifier.*` and `policy.log.*` (T23) still answer "lands with T22 / T23", because unknown-key reporting walks key paths (`shared/config/validate.ts`), not modules. How T22 adds its subkeys to a module another slice registered is recorded as an open question.

### D-12 Stage derivation takes a resolver

`stageOf(entries)` in `shared/store/state/derived.ts` becomes `stageOf(entries, stageOfTarget)`, where the graph passes a function mapping a node or instance id to its `stage` and a stage id to itself; `shared/store` stays ignorant of the pipeline. The `to_stage` index column keeps the raw `to`. `change status`, `change resume` and `next` compute the stage through the graph.

### D-13 Record the resolutions in the plan

As T20 did, the T21 section of `docs/V3-IMPLEMENTATION-PLAN.md` gets one line per "To resolve" item pointing to this Change, and the T22, T23, T24 and T41 rows are told what T21 fixed for them: `budget` names on nodes, the `post-task-step` kind and fake-kind test, gate entries the kernel recognises (`gate`, `source`, `>=` ready time), and the `next` output and `architecture: false` the stage skills rely on.

## Risks / Trade-offs

- [`next` latency: YAML parse, file hashing and a git spawn for `review`] -> the pipeline is parsed once per process, hashing reads only the files of nodes that have a done entry, `codeTreeHash` runs only when `review` has one; an E2E case measures `next` on a fixture with 8 plan parts and 1 000 entries against the 150 ms budget of T24.
- [Sealing hides post-gate edits from the flow] -> accepted by T1 (risk "Gate binds to time, not content"); `explain` and `change status` show the stale node with both hashes, and checkpoint commits (T22) keep the history.
- [Same-second comparison lets an entry typed in the second of a `done` count] -> only `hooks prompt-expansion` writes user entries and it checks readiness first (T24); a human cannot type within the second of a kernel write that preceded the check.
- [Kind classes accumulate logic that YAML used to show] -> `explain` names the kind rule that skipped a node (`why`), so the reason is visible without reading code.
- [Thirteen kinds, several with placeholder behaviour until T22, T23, T30] -> each kind's placeholder is explicit (`doneBy` names the owning command; baseline validator), and the owner tasks extend the same class; no stub returns a fake `done`.

## Migration Plan

- The index schema version goes from 2 to 3; every existing index is dropped and rebuilt on the first command (T20 D-3 behaviour). No committed file changes: `input-hash` and `architecture` are optional fields, so every T20 Change still validates.
- Existing T20 Changes have no done transitions: their nodes derive as `ready` from `intent` on, so `next` on an old Change returns its first node.
- `pipeline/` joins the plugin's shipped files; `dist/bdk.mjs` and `schema/` are regenerated by `pnpm build`.
- Rollback is a revert of the PR; ledger entries with `input-hash` written meanwhile would then fail the T20 schema, which only matters on a branch that ran T21 and is reverted, i.e. never on `main`.

## Open Questions

- **Project-defined nodes (D3 "a gate is a graph node the project adds in YAML").** T21 lets a project switch the two shipped gates between `manual` and `auto` only. Recommendation: add a `pipeline.nodes` settings key (nodes of registered kinds only, same schema and limits, appended before `close`) when the first project asks, as its own Change; nothing in T21's model blocks it.
- **Shared `policy` module.** T22 and T23 add `policy.*` subkeys whose consumers are other slices. Recommendation for T22: let the config registry accept one module per subtree (`policy.budgets` registered by `attempt`) rather than moving `policy` into `shared/config`.
