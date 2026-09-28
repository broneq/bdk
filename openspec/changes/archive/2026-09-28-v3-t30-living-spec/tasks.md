# Tasks

## 1. Contract and plan

- [x] 1.1 Update `schema/cli/commands.json` for the deltas: `change close` drops `--squash`, gains `policy/spec-invalid`, `policy/git-in-progress`, `policy/git-hook-failed` and writes `.bdk/changes/archive/<id>/`; `doctor` drops `policy/merge-hash-mismatch` (exits `0, 3, 5`); update the hand-written output schemas `spec-delta-check` (new problem codes, passing example with the nested path), `change-close` (no `squashed`, archive path, empty learning lists) and `doctor` finding description; remove `policy.checkpoint.squash-at-close` from the planned keys and move the tests that used it as the planned-key example to `rules.max-per-package` (T31); verify `pnpm test:contract` fails only on the missing handlers, then passes the index and schema checks
- [x] 1.2 Sync the main specs from the deltas (`kernel-cli`, `kernel-cli/{spec,change,service}`, `kernel-state`, `kernel-loops`, `kernel-pipeline`, `kernel-settings`, `kernel-architecture`); verify `openspec validate --specs --strict` and the `pnpm test:contract` spec checks (rule table "Emitted by", write map, settings tables, import matrix) pass
- [x] 1.3 Record T30-D0 to D15 in the T30 entry of `docs/V3-IMPLEMENTATION-PLAN.md` (resolved "To resolve in the spec" items, `--squash` dropped, nested delta paths) and drop the "Fixed by T22" squash line; verify by reading the section against design.md

## 2. State, store and settings

- [x] 2.1 Write failing unit tests for the state changes: nested `spec-delta/<capability>.md` accepted by the layout and a malformed one refused (`state/ledger-invalid`), `spec-impact` optional in the plan part schema; implement in `kernel/src/shared/store/state/`; verify unit tests and the state schema contract test pass after `pnpm build`
- [x] 2.2 Write failing unit tests for `Store.move` (a directory with nested files on the memory store and on disk, target parents created, an existing target refused); implement in `shared/store/store.ts`; verify they pass
- [x] 2.3 Write failing tests for the `spec` module (`spec.normative-word`, default `SHALL`, non-empty) and the `archive` module (`archive.keep-evidence`, default `false`); register both with consumers `spec` and `change`; verify `bdk config show` E2E, the settings contract test and the S6 consumer test pass once their readers land in 3.x and 5.x

## 3. `spec` slice: grammar, check, merge, diff

- [x] 3.1 Write failing unit tests for the delta parser and the living spec parser (sections, requirement blocks, statements, scenarios with WHEN / THEN, REMOVED scenario lists, title line, line numbers, canonical rendering byte for byte, body hash); verify they fail for the missing module
- [x] 3.2 Implement `kernel/src/spec/domain/` (parser, renderer, hash) and `kernel/src/spec/config.ts`; verify 3.1 passes
- [x] 3.3 Write failing unit tests for every problem code of `spec delta check` (the scenarios of the `kernel-cli/spec` delta: without WHEN, scenario lost, removal through REMOVED, configured normative word, plus `scenario-prefix`, `then-missing`, `scenario-missing`, `requirement-unknown`, `requirement-exists`, `requirement-duplicate`, `section-unknown`, `purpose-missing`, `delta-empty`, and a check after a merge by the same Change still passing); implement the check use case; verify they pass
- [x] 3.4 Write failing unit tests for the merge (REMOVED whole and partial, MODIFIED in place, ADDED appended in delta order, purpose replaced, capability created, idempotence byte for byte, edited delta after a first merge, hash mismatch and missing hash refused, `gate:review` required without `--dry-run`, conflict per requirement against an archived Change closed after creation, no conflict for an earlier one or equal text, resolution by a `decision` naming the Change and the delta, `--dry-run` lists conflicts and writes nothing); implement the merge use case; verify they pass
- [x] 3.5 Write failing unit tests for `spec diff` (added, modified, removed, scenario counts, scenario-only removal as `modified`, unknown capability `input/not-found`); implement; verify they pass
- [x] 3.6 Add the command handlers, zod output schemas (generated `schema/cli/output/spec-*.json`), renderers and registrations; write E2E tests for every exit code and rule of the three records and the acceptance scenarios (delta without WHEN rejected, scenario removed without REMOVED, idempotent merge, two Changes on one requirement refused with both texts, conflict resolved by a decision, capability created with its purpose); verify `pnpm build && pnpm test:e2e` passes them and the import scan keeps `spec` a leaf

## 4. Graph validators

- [x] 4.1 Write failing unit tests: the `spec-delta` kind lists nested deltas and fails check `delta:<capability>` with `policy/spec-invalid` naming the problems; the `plan-part` `spec-impact` check fails for a missing or invalid delta and for an absent field in `large`, and passes an absent field in `small`; verify they fail
- [x] 4.2 Implement `specDelta` in the graph view through `spec`'s `index.ts` (normative word from the resolved settings), the kind checks, and add `graph -> spec` to the import matrix code; verify 4.1, the existing graph and part tests and the import scan pass
- [x] 4.3 Write E2E tests for `bdk validate spec-delta` (text mode exits 2 with `policy/spec-invalid`) and `bdk validate plan-part:02` with an invalid delta; verify `pnpm build && pnpm test:e2e` passes them

## 5. `change close` and `doctor`

- [x] 5.1 Write failing unit tests for `change close`: refusal order (gate, open ticket, trailer mismatch, git in progress, hash mismatch, conflict, invalid delta) with nothing written, dry run writing nothing, the happy path (specs merged, `close` transition, prune unless `archive.keep-evidence`, move to `.bdk/changes/archive/<id>/`, marker removed, index row archived), the PR summary from the ledger, `gatesByPolicy`, `spec.unchanged`, empty learning lists; verify they fail
- [x] 5.2 Implement `change/use-cases/close.ts`, the handler, the zod output schema (generated `schema/cli/output/change-close.json`) and the renderer, calling `spec`'s merge, `graph`'s done marker, the prune and `pathspecCommit` (`chore(bdk): close <id>`, `BDK-Change` trailer); verify 5.1 passes
- [x] 5.3 Write E2E tests for every exit code and rule of `change close` and the delta scenarios (close archives, prunes and commits touching only its paths; keep evidence; dry run leaves `git status --porcelain` unchanged; git hook failure); verify `pnpm build && pnpm test:e2e` passes them
- [x] 5.4 Write failing unit and E2E tests for the `doctor` `merge-hash` finding (manual edit after a merge, file without the key, healthy specs give no finding); implement in `service/use-cases/doctor.ts` through `spec`'s `index.ts`; verify they pass

## 6. OpenSpec compatibility and CI

- [x] 6.1 Write the contract test that merges a fixture Change through `dist/bdk.mjs`, copies `.bdk/specs/` into `openspec/specs/` of a temporary repository and runs `openspec validate --specs --strict --json`, skipped with a message locally without `openspec` on `PATH` and failing when `CI` is set and it is missing; verify it passes locally with OpenSpec 1.13.2
- [x] 6.2 Install `@fission-ai/openspec@1.13.2` in `.github/workflows/tests.yml` before the contract tests; verify the workflow file with a YAML parse and by reading the step order

## 7. Acceptance and docs

- [x] 7.1 Update the user documentation that describes spec deltas, `change close` or `doctor` findings (`docs/guide/`), README rows if any name the commands, and run `pnpm docs:build`; verify the strict build and the docs drift guards in `pnpm test:contract` pass
- [x] 7.2 Run the acceptance signal end to end on a fixture repository through `dist/bdk.mjs`: a delta without WHEN rejected; a delta removing a scenario without REMOVED is an ERROR; two Changes editing the same capability, merge refuses and shows both; a manual edit of `spec.md` after merge reported by `doctor`; merge twice gives the same file; `openspec validate` accepts the merged `.bdk/specs/`
- [x] 7.3 Run `pnpm build`, `git diff --exit-code dist/ schema/` after the build, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`; then `openspec validate v3-t30-living-spec --strict`
