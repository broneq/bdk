# Design

## Context

See proposal.md, Why. Current state of the code this Change builds on:

- `kernel/src/shared/store/` (T11): `Store` with `read`, `write` (temp file plus rename), `list`, `exists`, `isDirectory`, a `memoryStore` for use-case tests, `splitFrontmatter`, and the SQLite index skeleton (`index-db.ts`, `meta` table only). No schema, no path builder.
- `kernel/src/shared/ids/index.ts` (T11): provisional `newId(prefix, random = Math.random)` producing five base36 characters, and `parseReference`. Its header says T14 fixes the format.
- `kernel/scripts/export-schemas.ts` (T12): one exporter, run by `kernel/build.mjs` after bundling, that writes `schema/settings.json` from the config registry and a zod registry of `schema/cli/` files with relative `$ref`s, formatted by prettier. CI fails on `git diff --exit-code dist/ schema/`.
- `kernel/tests/support/schemas.ts`: Ajv 2020 over `schema/cli/`; `kernel/tests/contract/settings-spec.test.ts` parses the key tables of `kernel-settings` and compares them with the registry. Both are the models for the state contract tests.
- `schema/cli/commands.json` carries `writes[]` per command; `cli-contract.test.ts` checks only that `read` commands write nothing.
- The CLI output schemas already render state objects (`log-show.json` entry, `attempt-open.json`, `evidence-record.json`, `change-status.json`) with `"description": "Opaque merge-safe id (T14)."`; their field sets are the starting point of the document tables, so no command output changes shape.

## Goals / Non-Goals

**Goals:**

- One zod definition per document kind, used by the store on read and write, exported to JSON Schema, mirrored by the spec's tables, and checked three ways (fixture, spec tables, CI diff).
- A write map that a test can check against `commands.json`, so a later task cannot add a writer or a path silently.
- Merge safety proven in a real git repository before T20 writes the store.

**Non-Goals:**

- Store operations beyond what the tests need (no `log add`, no index tables, no path allocation for real commands): T20.
- Checking artifact bodies (plan task grammar, dispatch sections, report structure beyond the `bdk-entries` block's presence): T21, T22, T23.

## Decisions

### D-1 IDs: prefix plus eight random base36 characters

`newId` draws eight characters of `[0-9a-z]` from `node:crypto` (`randomInt`), keeps the `L-`/`A-`/`E-` prefixes and the injectable random source for tests. 36^8 is about 2.8 x 10^12; the birthday probability for 10 000 ids in one Change is about 1.8 x 10^-5, and a collision is still loud (`state/ledger-invalid` on read, see the spec) rather than silent, because file names carry more than the id.

- _ULID_ (Q-4's first option): 26 characters, about 3x the tokens in every ref, envelope and dispatch package; its time component duplicates `at` and the `<ts>` of the log file name. Lost on cost with no gain.
- _`<timestamp>-<slug>`_: not unique (two entries in the same second with the same slug), needs a slug from free text, and is long. Lost on uniqueness.
- _Keeping five characters_: 6 x 10^7 space, about 0.08 collision probability at 10 000 ids across a long-lived Change's branches. Lost on robustness.

### D-2 One file per object, names carry the id or ticket

`log/<ts>-<type>-<id>.md`, `attempts/<loop>-<target>-<ticket>.md`, `evidence/<target>-<E-id>.md`, `dispatch/<target>-<role>-<ticket>.md`, `reports/<target>-<role>-<ticket>.md`. The design's append-only `attempts/<loop>-<target>.md` and the numbered `<n>` suffixes are the three places where two branches of one Change would write the same path; V1-4's durability (records committed with every BDK commit) is unchanged.

- _Append-only single attempt file with union merge_ (`.gitattributes merge=union`): relies on repository configuration the user may not have, and a union merge of YAML frontmatter produces invalid documents. Lost.
- _Keeping `<n>`, allocating per branch_: `n` would need an allocator, which Q-4 removed. Lost.

### D-3 Schemas live in `shared/store/state/`, validated inside the store

`kernel/src/shared/store/state/` holds one module per document kind, `common.ts` (id, ref, hash, timestamp, path), a document registry mapping layout patterns to kinds, the fingerprint function and the migration chain. The store exposes `readDocument(path)` and `writeDocument(path, data, body)`, which parse frontmatter with `yaml`, check the version, validate with zod and refuse; T20 builds commands on them. `shared/store` is already admitted for every slice (`kernel-architecture`); the delta only names what it now holds.

- _A new `shared/state` module_: a second module over the same files, and the store would still need the schemas to validate on write. Lost on the R-store single access point.
- _Schemas per owning slice_ (`log/schema/`, `attempt/schema/`): `graph`, `service` (`rebuild`, `doctor`) and `dispatch` read documents of other slices, which the dependency matrix forbids except through `shared/store`. Lost.

### D-4 Frontmatter in kebab-case, CLI output in camelCase

Documents are YAML the user reads in PRs, next to settings that are kebab-case by user decision (T12 Q5), and the design already names `kernel-version`, `template-hash`, `do-not-touch`, `success-measure`. CLI JSON stays camelCase as T10 fixed it. The mapping is mechanical and lives in the render layer of each slice.

- _camelCase in files_: one convention fewer, but contradicts the design's field names and the settings convention in the same `.bdk/` tree. Lost.

### D-5 Fingerprint normalisation

As specified in `kernel-state`, Fingerprints: NFKC, lowercase, digits to `#`, other non-alphanumeric runs to one space, trim, SHA-256 over parts joined by U+001F. It removes the variation that carries no meaning in a lesson or a finding (case, punctuation, line numbers, counts) and nothing else, so it stays deterministic and explainable.

- _Stemming or stop-word removal_: language-dependent, needs a dictionary dependency, and T31's thresholds are the place for fuzzy grouping. Lost.
- _Including `applies` in a learning's fingerprint_: the same lesson seen in two directories is exactly the recurrence Q-4 counts. Lost.
- _Model-provided keys_: not reproducible across runs. Lost.

### D-6 One exporter, `schema/state/`, settings stay at `schema/settings.json`

`export-schemas.ts` gains a third registry for the state kinds with `$id` base `https://raw.githubusercontent.com/broneq/bdk/v3/schema/state/` and the same relative-`$ref` rewrite as `schema/cli/`, so `common.json` is shared by `$ref`. Each state schema is exported with `io: "output"` (the documents as stored).

- _A CLI command (`bdk state schema`)_: no consumer; `config schema` exists because the IDE and `doctor --fix` need the settings schema offline, and no user edits state files by hand. Lost.
- _Moving settings to `schema/config/`_: breaks the `$schema` modelines already written into user settings files. Lost.

### D-7 Versioning: current version only on read, migrations in `rebuild`

Each kind has `version` and an ordered `migrations: Array<(doc) => doc>` in its module, empty at 1. `readDocument` refuses a lower version with `state/ledger-invalid` naming `bdk rebuild`; `migrateDocument` runs the chain and validates. `rebuild` itself is T22's; T14 ships the function and tests it with an injected version-2 schema and migration. The `rebuild` delta in `kernel-cli/service` records that it will call it.

- _Upcasting on every read_: every command pays the migration cost and old files stay old forever, so two kernel versions on one team keep rewriting each other's view. Lost.
- _No versioning until needed_: the first schema change would have no way to tell old files from corrupt ones. Lost.

### D-8 Generated indexes are written by `done`, `part split` and `rebuild`

`plan/index.md` and `design/index.md` are pure functions of their parts (waves from `depends-on`), serialised deterministically (keys in schema order, parts by id), so regeneration after a merge yields identical bytes on both sides whenever the parts agree. `done` is the natural writer: it already validates the plan and design nodes and records their input hash.

- _Index written by the `plan` skill_: the model would maintain a derived file by hand and two branches would diverge on it. Lost.
- _Index only in `.machine/`_: loses the human-readable plan overview in PRs and `dispatch run --wave` would depend on a cache. Lost.

### D-9 Reports: workers write their own, read-only roles through `log ingest`

A worker or runner writes its report at the `report` path its package names, so the full report never passes through the orchestrator's context (the design's reason for a 15-line envelope). A read-only role has no file tool and its whole final message already reaches the orchestrator (the `bdk-entries` relay, T2); `execute` disallows `Write` (P9), so the kernel stores it when the orchestrator pipes it to `log ingest`. `dispatch run` writes reports in headless mode.

- _Every report through the kernel (`attempt close --envelope -`)_: forces a worker's full report through the orchestrator's context. Lost.
- _Giving read-only roles `Write`_: breaks "no agent gains a tool for BDK's sake" (T2). Lost.

### D-10 Write map as spec tables, checked by a contract test

The file and entry-type tables in `kernel-state` are the machine-readable map: `kernel/tests/contract/state-write-map.test.ts` parses them (the same table parser as `settings-spec.test.ts`, moved to `kernel/tests/support/`), classifies each writer as a command of `commands.json` or a named skill/role, and checks availability, `writes[]` coverage in both directions and that each command requirement's `**Writes:**` line equals its `writes[]`. No separate YAML map: the spec is the first-class document and a second copy would drift.

- _A `write-map.json` next to `commands.json`_: a third copy (spec, JSON, code) of the same facts. Lost.

### D-11 Merge test on documents written through the store

`kernel/tests/contract/state-merge.test.ts` creates a temporary repository, commits the fixture Change, then on two branches writes new documents through `writeDocument` with fresh ids (the commands do not exist yet), commits, merges with `git merge --no-ff`, and asserts: no conflict, every file validates, no duplicate id. The second case edits one rule file on both branches and asserts the conflict list is exactly that file. T20 reruns the same scenario on real kernel output (its acceptance signal).

- _Waiting for T20_: T20 would build the store on an unproven layout. Lost; this is the Q-4 finding the task exists for.

## Risks / Trade-offs

- [Change id collision: two people open a Change with the same slug on the same day on different branches] -> the merge shows an add/add conflict on `change.md`, which is loud; the second Change is renamed by hand. Adding random characters to Change ids was judged not worth the loss of readable directory names.
- [Host-tool writers are not enforced] -> validated at `done` and `attempt close`; T24 decides whether `hooks pre-tool` denies tool writes into kernel-channel paths, and the write map already marks which paths those are.
- [The spec tables and zod drift] -> the state schema contract test compares them field by field, and CI's `git diff` catches an unexported zod change.
- [The CLI deltas touch commands owned by T21, T22] -> they only add `writes[]` paths and one behaviour sentence each; the owning tasks implement them. Listed in the plan update so the owners see it.
- [Frontmatter written by a model (`design.md`, parts) fails validation more often than kernel-written files] -> `bdk next` (T21) renders the template with the frontmatter, and `done` names the field.

## Migration Plan

No user data exists in the v3 format yet (T20 writes the first Change), so there is nothing to migrate. The id format change in `shared/ids` has no persisted consumers. Rollback is reverting the PR; `schema/state/` disappears with it.

## Open Questions

None that change the spec or the tasks. Decisions D-2 (attempt, evidence, dispatch and report file names), D-8 (`done` writes the indexes) and D-9 (report writers, `log ingest` delta) amend the design or other tasks' commands and are presented at the spec gate (task 1.3) for explicit acceptance.
