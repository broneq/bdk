# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T10. Tracks #48.

The design fixes the kernel's command groups, exit codes, refusal shape and the two output modes only in outline and leaves "the exact CLI contract (JSON shapes, error codes, examples)" as the first plan artifact ("What We Did NOT Decide"). Six later tasks consume that artifact directly: T11 runs contract tests against it, T14 cross-checks its command split, T24 implements its `hooks` group, T40 grades skills against it, T41 / T42 write skills that call nothing but these commands, and T15 / R-13 make `bdk <group> --help` the only usage text a skill may carry. Without one document written before any code, each of those tasks invents its own shapes.

## What Changes

- New `docs/CLI-CONTRACT.md`: the human-readable contract of `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs <args>`. Cross-cutting sections first (invocation form, the two output modes, the one allowed `!` wrapper and the `|| exit 2` guard form, exit codes, the four-field refusal shape, `--json` conventions, list limits, command availability split, contract versioning, `--help`), then one entry per command: arguments, availability, mode, exit codes, output shape, refusal rules with a worked example, owner task.
- New `schema/cli/`: the machine-readable half that T11's contract tests read. `commands.json` is the command index (one record per command: id, argv path, arguments, availability class, mode, exit codes, refusal rule ids, output schema reference, owner task). `output/<command-id>.json` holds one JSON Schema (draft 2020-12) per `--json` success output, `common/` the shared shapes (refusal, list page, version). Design D-1 explains why the schemas are files next to the document rather than fenced blocks inside it.
- New `tests/contract/cli-contract.test.mjs` (`node:test`, no dependencies): every command in the index has a section in the document and vice versa; every referenced schema file exists and parses; every refusal example in the document has exactly the four fields; every `bdk ...` command mentioned in the design's sequence diagram, hooks table, skill inventory, CLI outline and Key boundaries, and in the plan's task scopes, resolves to an index entry (the acceptance signal's cross-review, made repeatable). A `node --test tests/contract/` step is added to `.github/workflows/tests.yml` next to the pytest step; T11 folds it into its own harness.
- Command inventory covered: every group from the design's "CLI contract (outline)" (`change`, graph `next` / `explain` / `validate` / `done`, `part`, `attempt`, `log` including `ingest`, `dispatch`, `evidence`, `spec`, `config`, `ctx`, `rules`, `query`, `commit`, `hooks`, service `doctor` / `rebuild` / `import` / `version`), plus the commands the plan added after the T02 resolution: `measure`, `change checkpoint`, `change new --kind` / `--inferred`, `export agents --host`, `rules add` / `explain` / `prune` / `import` / `stats` / `export --claude`, and the headless wave runner (see below). Each entry names the task that implements it, so T11 can stub the rest with an explicit `refused`.
- Removals and non-additions carried into the contract: no `approve`, no `gate pass` (T1); no `stage enter` (HOST-FACTS `upe-fires`: `UserPromptExpansion` fires for plugin skills, so the "`!` blocks call only `ctx` and `next`" boundary stands); no `hooks stop` (T02 decision Q-6: `check-rules-drift` is not ported); `hooks prompt-expansion` documented against the namespaced `command_name` (`bdk:plan`) from HOST-FACTS `upe-name`.
- Resolutions of the plan's "To resolve in the spec" items (details and alternatives in design.md):
  - Argument syntax: mandatory discriminators are positional literals (`attempt close A-0007 ok`), optional modifiers are flags; `--outcome ok` loses.
  - Contract versioning: the contract version is the kernel's major version (`3`); `bdk version --json` reports `kernel`, `contract` and `node`; schema `$id`s carry `v3`; additive changes are allowed within a major. P10's `kernel-version` in the dispatch package stays the full kernel semver.
  - Output schemas live in `schema/cli/`, hand-written now; T11 / T12 make the zod-exported schemas reproduce them and guard the directory with `git diff --exit-code` like the rest of `schema/`.
- Kernel architecture (user request, 2026-09-25): a "Kernel architecture" section inside `docs/CLI-CONTRACT.md` designs the kernel itself as a vertical slice architecture: one module per command group / capability (`change`, `graph`, `part`, `attempt`, `log`, `dispatch`, `evidence`, `spec`, `config`, `ctx`, `rules`, `query`, `commit`, `hooks`, `service`, `measure`, `export`), each owning its own layers (argument parsing, use case, store access, text / JSON rendering, output schema) and its tests; a `shared/` kernel only for OS boundaries and cross-cutting primitives (store per R-store, git, config, ids, clock, refusal, output writer, command registry). Every `commands.json` entry carries a `slice` field, so the contract and the architecture are joined by one key and the coverage test checks the parity. Design D-13 records the alternatives (horizontal layers, hexagonal).
- Two naming conflicts the plan left open are settled in the contract and written back into the plan as a T10 Resolution paragraph: the headless wave runner is `dispatch run <part> --wave <n>` (the plan says `bdk execute --wave N` in T23 and `bdk run` in T41; both collide with the stage skills `/bdk:execute` and `/bdk:run`), and every non-zero exit uses the same four-field shape with `rule` prefixed by class (`input/`, `state/`, `runtime/`, `kernel/`), so exit 3, 4 and 5 need no second error shape.

Inputs carried by citation, not restated: design sections "CLI contract (outline; the full contract is the first plan artifact)", "Key boundaries", "UX Touchpoints" (Failure surface), "Hooks (V1-1, V1-2)", "Skill inventory", the sequence diagram under "Selected Approach", "Testing and CI"; decision register "Założenia wejściowe do 2A" (CLI contract as a first-class document), Q3, T1, T2, T3, P1, P2, P4, P6, P10, P11, K2-K4, R-store; `docs/HOST-FACTS.md` rows `upe-fires`, `upe-name`, `upe-fields`, `allowed-compound`, `allowed-control`, `node-sqlite-min`; plan T02 Resolution and the scopes of T11, T14, T20-T24, T30, T31, T41, T42; `docs/V3-SKILL-INVENTORY.md` R-4, R-13, R-14, Q-3.

Out of scope:
- Any kernel code, handler, stub or `--help` implementation (T11 and later). The contract is text and schemas only. The "kernel directory layout" item moves from T11's "To resolve in the spec" to this task: T11 builds the layout the architecture section describes and may amend it only with the reason recorded in the same section.
- The state schema and write map (`docs/STATE-CONTRACT.md`, `schema/state/`, T14); the contract names which command writes what only at the granularity T14 needs for its cross-check (command split and writer per command).
- Exact `pipeline.yaml` and `policy` schema, the instruction format inside `next` beyond "an opaque Markdown string", default budget values, the profile heuristic (T21, T22, T20). The contract fixes the fields around them, not their content.
- Hook prefilter shell lines, matcher regexes and deny message wording (T24); the contract fixes the `hooks` commands' input (stdin payload), output and exit behaviour.
- Content tests for skills (`skill-check`, T15) and the skill rewrite that adopts the wrapper form (T41, T42).
- Migrating the coverage test into the T11 `node --test` harness and Biome (T11).

## Capabilities

### New Capabilities

None. T10 produces a document, its machine-readable index and a consistency test, and changes no runtime behaviour, so `.openspec.yaml` sets `skip_specs: true` (project rule for document-only tasks). The acceptance signal is checked by the task list and by `tests/contract/cli-contract.test.mjs`.

### Modified Capabilities

None.

## Impact

- New: `docs/CLI-CONTRACT.md`, `schema/cli/commands.json`, `schema/cli/common/*.json`, `schema/cli/output/*.json`, `tests/contract/cli-contract.test.mjs`.
- Edited: `.github/workflows/tests.yml` (one `node --test tests/contract/` step); `docs/V3-IMPLEMENTATION-PLAN.md` (T10 Resolution paragraph; the T23 and T41 wording of the headless runner command aligned to `dispatch run`; the T11 contract-test bullet pointed at `schema/cli/commands.json` as well as the document; "kernel directory layout" removed from T11's "To resolve in the spec" with a pointer to the architecture section; T50's "kernel architecture `docs/`" item pointed at the same section).
- GitHub: issue #48 card set to In progress (done at start), closed after the merge.
- Downstream consumers: T11 (contract tests, stubs, `--help`), T12 (zod export must reproduce `schema/cli/`), T14 (command split cross-check), T15 / R-13 (`--help` as the source of usage text), T24 (`hooks` group), T40 (rubric), T41 / T42 (skills call only contract commands in the wrapper form).
- No skill, agent, hook script or Python change.
