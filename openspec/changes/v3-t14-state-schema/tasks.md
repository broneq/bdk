# Tasks

## 1. Start and the state spec gate

- [x] 1.1 Confirm issue #66's card shows "In Progress" on the project board (moved at change creation); verify with `gh project item-list 1 --owner broneq --format json`
- [x] 1.2 Review `specs/kernel-state/spec.md` and the five CLI / architecture deltas of this Change with the user as a Lavish artifact, highlighting the amendments to the design and other tasks: file names per ticket or id (D-2), eight-character ids (D-1), `done` writing the indexes (D-8), report writers and the `log ingest` delta (D-9), kebab-case frontmatter (D-4); apply the requested changes and verify `openspec validate v3-t14-state-schema --strict` passes
- [x] 1.3 GATE: the user accepts `kernel-state` and D-1..D-11 in writing; record the date and any amendment here. No task below starts before this box is checked. Accepted 2026-09-26 in `.lavish/v3-t14-state-schema.html` ("akceptuję kernel-state i D-1..D-11"), no amendment: every recommendation D-1, D-2, D-4..D-9 chosen, the entry-type table and the write map accepted as they are. The review added one example file per document kind (one Change, `2026-09-25-passwordless-login`) and settled one question: there is no tasks file; tasks live in the plan part body, their progress derives from `BDK-Task` trailers and attempt records, and `plan/index.md` holds no task list
- [x] 1.4 Record the T14 resolutions in `docs/V3-IMPLEMENTATION-PLAN.md` (T14 section: ID format, fingerprint, one exporter, enforcement split; T20, T22, T23 rows: the new attempt, evidence, dispatch and report file names, `done` / `rebuild` / `log ingest` writes); verify `git grep -n "<task>-<role>-<n>" docs/V3-IMPLEMENTATION-PLAN.md` finds nothing

## 2. Identifiers

- [x] 2.1 Write failing unit tests in `kernel/src/shared/ids/tests/ids.test.ts` (`kernel-state` Identifiers): `newId` yields prefix plus exactly eight `[0-9a-z]` characters; default source is `node:crypto`, the injected source is used when given; `parseReference` accepts `L-m2x9v7qa` and `2026-09-25-passwordless-login/L-m2x9v7qa`, rejects seven or nine characters and upper case; a Change id helper accepts `<yyyy-mm-dd>-<slug>` with a slug of at most 40 kebab-case characters; 10 000 generated ids are distinct; verify `pnpm test:unit` fails on them
- [x] 2.2 Implement the format in `kernel/src/shared/ids/index.ts` and replace its "provisional" header; verify 2.1 passes and `pnpm lint && pnpm typecheck && pnpm knip` are clean

## 3. Common definitions, ledger entry and change document

- [x] 3.1 Write failing unit tests under `kernel/src/shared/store/state/tests/` for `common` (id, qualified ref, `sha256:` hash, UTC timestamp with seconds, relative path, closed objects, no `null`) and for the `change` and `entry` kinds: every field of the spec tables with requiredness and enums, `summary` 1-120, `refs` >= 1, `source` pattern, `superseded` rejected as a stored status, each of the ten types with its own fields (`fingerprint` required on `learning`, `routed-to` required when `status: routed`, `to` required on `transition`, `report` required on `report`), own fields of one type rejected on another; verify they fail
- [x] 3.2 Implement `kernel/src/shared/store/state/common.ts`, `change.ts`, `entry.ts` (zod, kebab-case keys, `version = 1`, empty migration list); verify 3.1 passes

## 4. Attempt, evidence, dispatch and report

- [x] 4.1 Write failing unit tests for the `attempt`, `evidence`, `dispatch` and `report` kinds from the spec tables: `closed-at` present exactly with `outcome`, `findings` item shape, `files` >= 1 with `stored` enum, `template-hash` and `kernel-version` required, report `status` enum with `reason` required for `blocked` and `needs-context`; verify they fail
- [x] 4.2 Implement `attempt.ts`, `evidence.ts`, `dispatch.ts`, `report.ts`; verify 4.1 passes

## 5. Plan, design and generated indexes

- [x] 5.1 Write failing unit tests for `plan-part`, `plan-index`, `design`, `design-part`, `design-index` and for index generation: `id` equals the file's `<nn>`, waves from `depends-on`, identical bytes on regeneration from unchanged parts (order of input files irrelevant), cycle and missing dependency fail naming the parts; verify they fail
- [x] 5.2 Implement the five kinds and `generatePlanIndex` / `generateDesignIndex` (deterministic YAML and rendered body table); verify 5.1 passes

## 6. Rule files

- [x] 6.1 Write failing unit tests for the `rule` kind: id pattern (`CQ-4`, `BDK-SEC-2`, not `cq-4` or `CQ-0`), `id` equals the file name, `source` and `verified` required exactly for `kind: knowledge`, `origin` values including `<changeId>/<L-id>`, `removed` tombstone accepted; verify they fail
- [x] 6.2 Implement `rule.ts`; verify 6.1 passes

## 7. Fingerprints

- [x] 7.1 Write failing unit tests for `normalise` and `fingerprint` (`kernel-state` Fingerprints, design D-5): NFKC folding, case, punctuation and whitespace runs, digit runs to `#`, non-Latin letters kept, U+001F joining so `("a b", "c")` and `("a", "b c")` differ, `sha256:` plus 64 hex, the spec's "cosmetic variants" scenario; verify they fail
- [x] 7.2 Implement `kernel/src/shared/store/state/fingerprint.ts`; verify 7.1 passes

## 8. Document registry, validation in the store and versions

- [x] 8.1 Write failing unit tests on `memoryStore` for the document registry and `readDocument` / `writeDocument` / `migrateDocument` (design D-3, D-7): each layout pattern maps to its kind, an unmapped path in a Change is refused, `spec-delta/` is mapped but not schema-checked, an invalid write leaves the store unchanged, a read failure is `state/ledger-invalid` naming file and field, a lower `schema` names `bdk rebuild`, a higher one names the upgrade, an injected version-2 kind with a migration rewrites a version-1 file and validates it; verify they fail
- [x] 8.2 Implement `kernel/src/shared/store/state/registry.ts` and the three functions, export them from `kernel/src/shared/store/index.ts`, and correct the T14 mentions in `index-db.ts`, `frontmatter.ts`, `kernel/src/service/use-cases/doctor.ts` and `kernel/src/service/commands/doctor.ts` to the tasks that own the remaining work (T20, T22, T30); verify 8.1 passes, the `node:` boundary test stays green, and `pnpm lint && pnpm typecheck && pnpm knip` are clean. Amendment found here: the gate example commits a capture next to its manifest (`evidence/02-3-E-5hq0m2vd.junit.xml`), which no layout row named; `kernel-state` gains the row `evidence/<target>-<evidenceId>.<ext>` (evidence capture, not schema-checked)

## 9. JSON Schema export

- [x] 9.1 Extend `kernel/scripts/export-schemas.ts` with the state registry (design D-6: `$id` base `.../v3/schema/state/`, relative `$ref`s to `common.json`, `io: "output"`, `unrepresentable: "throw"`) and run `pnpm build`; verify `schema/state/` holds the thirteen files of the spec, a second `pnpm build` leaves `git status --porcelain schema/` empty, and `dist/bdk.mjs` is unchanged apart from the id and store code
- [x] 9.2 Extend `kernel/tests/support/schemas.ts` so Ajv also loads `schema/state/` (`validatorFor` by kind); verify the existing contract tests still pass with `pnpm test:contract`

## 10. Fixture and spec tables

- [x] 10.1 Build the fixture `kernel/tests/fixtures/state/.bdk/` by hand, starting from the example files of the gate review page (task 1.3): one complete Change (every layout row, all ten entry types, an open and a closed attempt, evidence, a package and a report per role class, plan and design parts with generated indexes, a spec delta) and rule files of both kinds including a tombstone; generate the indexes with 5.2 and check them in
- [x] 10.2 Write `kernel/tests/contract/state-fixture.test.ts` (`kernel-state` State fixture): every file maps to a kind, validates with zod and with Ajv, and every kind and entry type is present; seed an unmapped file, a missing entry type and a JSON-Schema-only violation one at a time and verify each fails, then remove the seeds and verify it passes
- [x] 10.3 Move the table parser of `settings-spec.test.ts` to `kernel/tests/support/` and write `kernel/tests/contract/state-spec.test.ts` (design D-10): read the field tables of `kernel-state` (the Change's delta until the archive, then `openspec/specs/kernel-state/spec.md`) and compare field names, requiredness and enum values with `schema/state/`; seed a renamed field and a dropped enum value and verify each fails, then verify it passes and `settings-spec.test.ts` still passes

## 11. Write map and the CLI contract

- [x] 11.1 Update `schema/cli/commands.json` for the deltas: `done` writes `plan/index.md` and `design/index.md`; `rebuild` writes `.bdk/changes/<id>/` and `.bdk/rules/`; `log ingest` writes `reports/`; verify the `**Writes:**` lines of the three delta requirements list exactly these values
- [x] 11.2 Write `kernel/tests/contract/state-write-map.test.ts` (`kernel-state` Write map and Write map enforcement, design D-10): every layout row and every entry type has a writer; each command writer exists in `commands.json` with availability `orchestrator`, `agent` or `hook` and a `writes[]` covering the path; every Change or rules path in any `writes[]` is named for that command in the file table; each command requirement's `**Writes:**` line equals its `writes[]`; `source: user` appears only for `hooks prompt-expansion`; seed a `read` writer, an undeclared `writes[]` path and a `Writes:` mismatch one at a time and verify each fails, then verify it passes. Amendments found here: `import` writes Changes, so it joins the `change.md` row (reusing `change new --inferred`); `part split` writes a `decision`; `log resolve` rewrites status in place and records `superseded` as `supersedes` on the `--by` entry (new MODIFIED requirement in the `kernel-cli/log` delta, closing the question it left to T14; its example `record` becomes the rewritten entry)
- [x] 11.3 Update the `"Opaque merge-safe id (T14)."` descriptions in the hand-written `schema/cli/output/*.json` to name `kernel-state` Identifiers (the five-character ids in command examples stay: the Conventions call them illustrative); verify `pnpm test:contract` passes

## 12. Two-branch merge

- [x] 12.1 Write `kernel/tests/contract/state-merge.test.ts` (design D-11, `kernel-state` Two-branch merge): temporary repository with the fixture committed; branches A and B each write through `writeDocument` entries of several types, an attempt opened and closed, evidence, a dispatch package, a report, a different accepted rule and a spec delta for a different capability; `git merge --no-ff` of B into A has no conflict, every merged file validates and ids are unique. Second case: both branches edit the same rule body; the conflict list is exactly that file. Verify both pass, and verify the first fails when D-2 is violated on purpose (both branches write `attempts/<loop>-<target>.md`), then remove the seed

## 13. Acceptance

- [ ] 13.1 Check the Acceptance signal end to end: `pnpm build` then `git diff --exit-code dist/ schema/` is clean; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e` and `pnpm test:contract` pass; the fixture, write map and merge tests are in the contract run; every file and entry type of the Change directory has a writer cross-checked against `commands.json`
- [ ] 13.2 Run `openspec validate v3-t14-state-schema --strict`; verify it is valid
