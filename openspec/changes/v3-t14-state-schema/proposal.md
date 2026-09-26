# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T14. Tracks #66.

The CLI contract (T10) fixes what every command reads and prints, and the settings spec (T12) fixes the configuration, but nothing fixes what the kernel writes into a Change. The shape of the Change directory is scattered over the design ("Change directory", "Ledger entry", "Dispatch package", "Plan part fields"), the CLI output schemas and the plan rows of T20, T21, T22 and T23, and parts of it contradict the merge-safety requirement found in T02 (Q-4): the design's sequential `L-nnnn` ids, its append-only `attempts/<loop>-<target>.md` file and its numbered `dispatch/<task>-<role>-<n>.md` names all collide when two branches work on the same Change. T20 builds the store on top of this shape, so it must be one machine-readable document, the second first-class document next to the CLI contract (T02 decision Q-2), before any store code exists.

## What Changes

- **New main spec `kernel-state`** (an OpenSpec main spec under `openspec/specs/`, like `kernel-cli`; it replaces the `docs/STATE-CONTRACT.md` that T02's Q-2 row names, since a living spec never lives under `docs/`). It holds the Change directory layout, one field table per document, the derived-state rules, the id and fingerprint formats, schema versioning, the **write map** (T02 decision R-12) and the merge contract. Written as the first task group and accepted by the user before any code, as T12 did with `kernel-settings`.
- **zod schemas in `shared/store`** for every document the kernel writes or validates: `change.md` frontmatter, ledger entry (10 types including `transition`; `learning` gains `fingerprint` and `evidence`), attempt record, evidence manifest, dispatch package frontmatter, report envelope, plan part and `plan/index.md`, design artifacts, design part and `design/index.md`, rule file frontmatter. The store validates on every read and every write; a file that fails is `state/ledger-invalid`.
- **JSON Schema export to `schema/state/`** by the mechanism T12 built (`kernel/scripts/export-schemas.ts`, run by `pnpm build`, guarded on CI by `git diff --exit-code dist/ schema/`).
- **`schema: 1` in every document**, a version check on read, and a migration chain that `bdk rebuild` runs (empty at version 1; the mechanism is tested with an injected migration).
- **Merge-safe ids** in `shared/ids` (replacing T11's provisional five characters): `L-`, `A-`, `E-` plus eight random base36 characters from a CSPRNG, no allocator, no lock; cross-Change references `<changeId>/<id>`. Every per-object file name carries its id or ticket, so parallel branches never write the same path.
- **Fingerprint normalisation** shared by `learning` entries and attempt findings.
- **Mutable shared files minimised by construction**: `change.md` is written once; Change stage derives from the latest `transition` entry; `superseded` derives from the newer entry's `supersedes`; `plan/index.md` and `design/index.md` are regenerated from their parts; the only in-place mutations are an entry's `status` (`log resolve`, `log route`), an attempt record between open and close, and the generated indexes.
- **Contract tests**: a fixture `.bdk/changes/` whose every file validates against its schema (zod and the exported JSON Schema); the spec's field tables equal the exported schemas; the write map cross-checked against `schema/cli/commands.json`; a **two-branch merge test** in a real git repository (entries, attempts, evidence, dispatch packages, reports, an accepted rule and a spec delta on two branches merge without conflict; the only conflict is the same rule edited two ways).
- **CLI contract amendments** the write map forces (spec deltas plus `schema/cli/commands.json` in the same PR):
  - `kernel-cli` Conventions: the id format is now fixed; Availability classes: the T14 cross-check also admits artifact files written by stage skills and roles through the host's file tools, validated at `done`.
  - `bdk done` regenerates `plan/index.md` / `design/index.md` from their parts and writes a `transition` entry; `writes[]` gains both index files.
  - `bdk rebuild` runs schema migrations and regenerates the indexes; `writes[]` gains the Change directory files it migrates.
  - `bdk log ingest` stores a report passed on stdin under `reports/`, because a read-only role has no file tool and `execute` disallows `Write`; `writes[]` gains `reports/`.
- `kernel-architecture`: the `shared/store` row names the state schemas and validation; the `shared/ids` row names the fixed format and the fingerprint helper's home.

Resolutions of the plan's "To resolve in the spec" (details and rejected alternatives in design.md):

- **ID format**: prefix plus eight random base36 characters (`L-m2x9v7qa`), neither ULID nor `<timestamp>-<slug>`; time lives in `at` and in the log file name.
- **Fingerprint normalisation for `learning`**: NFKC, lowercase, digit runs to `#`, every other run of non-alphanumeric characters to one space, trim; `sha256:` over the type tag and the normalised summary (for attempt findings: type, file, symbol and normalised problem).
- **Shared export command**: one mechanism, no new CLI command: `pnpm build` runs the same exporter for `schema/settings.json`, `schema/cli/` and `schema/state/`. `schema/settings.json` keeps its path because published modelines point at it; there is no `schema/config/`.
- **Kernel-enforced versus documented write map**: enforced by the kernel for every file a kernel command writes (schema on write and read, kernel-stamped fields, paths built only by the store, availability classes through `hooks pre-tool`) and by contract tests for the map itself; documented plus validated at `done` for artifact files that skills and roles write through host file tools (`design.md`, `architecture.md`, design and plan parts, `spec-delta/`, worker reports). Whether `hooks pre-tool` also denies host-tool writes into kernel-owned paths is left to T24, which owns that guard.

Inputs carried by citation: design "Change directory", "Ledger entry (K1-K4, R-rule-id)", "Dispatch package (K3, K4)", "Plan part fields and plan-quality rules (P6, P7)", "Loop protection" (attempt durability, V1-4), "Verification evidence primitives (T4, P4, P5)", "Rules with IDs" and "Measure before numbering (T5)", Key boundaries (provenance P1, IDs V1-6); decision register K1-K4, P1, P10, R-store, R-rule-id; T02 decisions Q-2, Q-4, Q-5, R-8, R-9, R-12 (`docs/V3-SKILL-INVENTORY.md` sections 12-13); specs `kernel-cli` and its group specs, `kernel-architecture`, `kernel-settings` (Settings JSON Schema).

Out of scope:

- The SQLite index tables, dedupe keys per entry type, lazy rebuild and every `change` / `log` command (T20); `index-db.ts`'s comment is corrected to name T20.
- The body grammar of plan parts (task headings, `Files:`, `stop-rule`) and the part validators (T21, T22); the dispatch package body and its 12 KB limit (T23); `rules check`, rule numbering and the `BDK-*` pack (T31); the `spec-delta/` and `.bdk/specs/` format (OpenSpec's, checked by `spec delta check`, T30); the archive layout and pruning (T30).
- The `hooks pre-tool` rule set (T24), including any deny of host-tool writes into kernel-owned paths.
- Running the merge test on real kernel output (T20's acceptance signal); T14 runs it on documents written through `shared/store`.

## Capabilities

### New Capabilities

- `kernel-state`: the Change directory, the schema of every document in it and of rule files, derived state, ids and fingerprints, schema versioning and migrations, the write map, JSON Schema export and the merge contract.

### Modified Capabilities

- `kernel-cli`: Conventions (fixed id format) and Availability classes (T14 cross-check admits host-tool writers of artifact files).
- `kernel-cli/graph`: `bdk done` regenerates the plan and design indexes and writes a `transition` entry.
- `kernel-cli/service`: `bdk rebuild` runs schema migrations and regenerates the indexes.
- `kernel-cli/log`: `bdk log ingest` stores a report passed on stdin under `reports/`.
- `kernel-architecture`: the `shared/` admission table (`shared/store` holds the state schemas; `shared/ids` the fixed id format and the fingerprint).

## Impact

- New: `openspec/specs/kernel-state/spec.md` (at archive), `kernel/src/shared/store/state/` (zod schemas, document registry, fingerprint, migrations), `schema/state/*.json`, `kernel/tests/fixtures/state/` (fixture Change and rules), contract tests `state-schema`, `state-write-map`, `state-merge` under `kernel/tests/contract/`.
- Changed: `kernel/src/shared/ids/index.ts` (format), `kernel/scripts/export-schemas.ts`, `schema/cli/commands.json` (`writes[]` of `done`, `rebuild`, `log ingest`), `kernel/src/shared/store/index-db.ts` (comment), `docs/V3-IMPLEMENTATION-PLAN.md` (T14 resolutions; the attempt / dispatch / report / evidence file names in T20, T22, T23 rows where they restate the old names).
- No runtime dependency added: zod is already a dependency; the merge test uses the `git` binary the E2E harness already requires.
- Downstream: T20 builds the store and the index on these schemas and reruns the merge test on kernel output; T21, T22, T23, T24, T30, T31 read the write map for their writers.
