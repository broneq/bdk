# Tasks

## 1. Catalogue reader and report generator

- [x] 1.1 Write failing unit tests for the catalogue reader in `kernel/tests/support/acceptance.ts` on a fixture spec: it returns rows with ID, item and evidence kinds; it refuses a duplicate ID, an unknown evidence kind, an `accepted` row without a reason, an `open` row without an issue, and an `open` `S` row, each naming the row. Verify they fail for the missing module.
- [x] 1.2 Implement the catalogue reader (parses the table of `openspec/specs/acceptance-catalogue/spec.md`, or the change's delta until archive) and verify the tests of 1.1 pass.
- [x] 1.3 Write failing unit tests for the evidence matcher on fixture title lists per project: an item with `test` and no bracketed title is reported; a `perf` item answered only outside `perf` is reported; a `report <path>` to a missing file is reported; a title naming an unknown ID of a catalogue prefix is reported with its file; a title carrying two IDs answers both; a `describe` title answers its tests. Verify they fail.
- [x] 1.4 Implement the matcher and the title collector (`vitest list --json` per project, D3) and verify the tests of 1.3 pass and the collector returns the full names of a sample `describe.each` test.
- [x] 1.5 Write failing unit tests for the report renderer: generated marker first, one row per item with its kinds, file and full title per test, perf items marked "local only", byte-stable output for unchanged input. Implement it, add the `acceptance:report` script to the root `package.json` (build, then generate `docs/V3-ACCEPTANCE.md`), and verify the tests pass.

## 2. IDs on the existing evidence

- [x] 2.1 Add the bracketed ID to the title of the tests that already answer `S1`, `S2`, `S5`-`S8`, `S-DISPATCH`, `AC-2`-`AC-4`, `AC-6`-`AC-9` and `TSH-1`-`TSH-13` (the survey's map in design.md "Context"), changing only titles; verify `pnpm test:unit`, `pnpm test:e2e` and `pnpm test:contract` pass and the collector of 1.4 sees every ID.
- [x] 2.2 Add IDs for `EC-1`, `EC-2`, `EC-5`, `EC-6`, `EC-8`, `AC-5` (v2 detection tests), every `NFR-*` item except `NFR-SCALE-1`, and the `R-*` items with `test` or `perf`; verify the same suites pass.

## 3. Missing evidence

- [x] 3.1 Write the `AC-1` E2E: one `small` Change on the fixture from `change new` through design, one plan part, execute of one task, review and `close`, driven by kernel commands as the skills call them; verify it passes on the built bundle.
- [x] 3.2 Write the `EC-3` E2E: two Changes on two branches advanced with `next` and `log add`, both branches merged, `rebuild` gives both states and `status` lists both; verify it passes.
- [x] 3.3 Write the `EC-4` E2E: `settings.local.yaml` disables model escalation and the Change's local-override list names that key; verify it passes.
- [x] 3.4 Write the `S3` E2E (`explain` on a task prints part, plan, design and intent) and the `R-11` E2E (a call after an unchanged ledger records no index refresh in telemetry); verify both pass. (`explain` has no task node, so `S3` explains the task's `execute-part` and its row is restated; the 1 000-entry `log list` E2E already asserts `refreshed: false` and takes `[R-11]`.)
- [x] 3.5 Add content tests titled `[EC-7]` (the dispatching skills state one re-dispatch after a refused `log ingest`, then a `blocker`) and `[S4]` (the plan verifier contract asks for the rule ID tick list); verify they pass. If a skill lacks the text, restate the catalogue row to the code's behaviour and name the drift (D5). (Both rows restated: the skills resume once, then close the ticket `fail`; the roles cite rule IDs, with no tick list.)
- [x] 3.6 Check whether `attempt close` refuses an envelope claiming entry ids that do not exist; if it does, write the `[R-16]` test and verify it passes; if not, open a follow-up issue in the v3.0 milestone and set the row to `open #<n>`. (It does, `policy/entries-missing`; the existing E2E takes `[R-16]`.)
- [x] 3.7 Write `kernel/src/<slice>/tests/change-scale.perf.ts` titled `[NFR-SCALE-1]`: one scripted Change of about 200 kernel calls on a fixture with 8 plan parts, p95 per call under 150 ms, total printed (D6); verify `pnpm test:perf` passes in a Linux container (D11).

- [x] 3.8 Read the hook payload with the `read` builtin instead of `$(cat)` in `hooks/guard/pre-tool.sh`, `post-tool.sh` and `prompt-expansion.sh` (one fork and one exec less per tool call), pinned by E2E tests for a pretty-printed payload and a payload with and without a final newline; verify the hook E2E and contract tests pass and record the guard p95 before and after.

## 4. Catalogue guard on

- [x] 4.1 Write the contract test that runs the reader, collector and matcher on the real catalogue and the real tests and fails naming every unanswered item and unknown ID; verify it passes on the branch and fails after removing the `[TSH-7]` title (then restore it).
- [x] 4.2 Add the report equality check to the contract test, run `pnpm acceptance:report`, commit `docs/V3-ACCEPTANCE.md`; verify the test passes, and fails with the rerun hint after retitling one test without regenerating (then restore).
- [x] 4.3 Document the catalogue in `CONTRIBUTING.md` (how to add an item, title a test with its ID, regenerate the report) and verify the docs drift guards pass.

## 5. BDK's own rules

- [x] 5.1 Write the failing contract test of plugin-tooling "Repository rules managed by the kernel" (`.claude/rules/` holds only `bdk-generated*.md`; `bdk rules export --claude --check` passes); verify it fails naming the eight hand-written files.
- [x] 5.2 Run the four-test admission on every bullet of the eight files and record the verdict per bullet in the PR description (D10); verify every bullet has a verdict.
- [x] 5.3 Move the definitions: point `kernel/src/evidence/config.ts` at `kernel-settings` (Keys of evidence policy), point `kernel/tests/contract/rule-pack.test.ts` at `rules/README.md` and make sure that file states the phrases the test needs, move the testing procedure into `CONTRIBUTING.md`; verify `pnpm test:contract` passes except the test of 5.1.
- [x] 5.4 Write the surviving rules as one-sentence top-level bullets in the thematic source files (D10), run `bdk rules import --dry-run`, then `bdk rules import`, delete the source files and run `bdk rules export --claude`; verify `bdk rules check` passes and the test of 5.1 passes.
- [x] 5.5 Update `CLAUDE.md` (v3 layout, no pointers to deleted files, v3 steps for adding a skill), `CONTRIBUTING.md`, the `skill-check.config.ts` comment and `.claude/skills/docs-sync/references/docs-map.md`; verify `bdk doctor --json` in the repository reports no rule finding, a fresh session in the repository starts without a hook error, and `pnpm test:contract` and `pnpm skill-check` pass.

## 6. Guide v3

- [x] 6.1 Extend `kernel/tests/docs/shipped.test.ts` with the v2 workflow scenario over `README.md` and the site (migration page excepted) and add drift guard 6 (every `bdk <command>` named resolves to a registry command); verify both fail and name the current stale pages and mentions.
- [x] 6.2 Write the failing test that `reference/configuration.md` names every key of the configuration registry; write the page; verify the test passes.
- [x] 6.3 Write `getting-started/migration-from-v2.md` (hard cut, steps, removed skill and artifact maps, what is not migrated), move the v2 tables out of `reference/skills.md`, `reference/artifacts.md` and `getting-started/setup.md`; verify `pnpm docs:build` passes.
- [x] 6.4 Rewrite `index`, `getting-started/installation` and `getting-started/first-feature` for v3; verify the build passes and the pages leave the stale lists of 6.1.
- [x] 6.5 Rename and rewrite `workflows/trivial`, `workflows/standard`, `workflows/full-pipeline` as `workflows/tiny`, `workflows/small`, `workflows/large`; update `sidebar.ts` and inbound links; verify the build and the drift guards pass for these pages.
- [x] 6.6 Replace `concepts/plan-pipeline` with `concepts/change-pipeline` (including the README sections it absorbs, D8), `concepts/shared-foundation` with `concepts/context`, and rewrite `concepts/verification-scoping`; verify the build and the drift guards pass for these pages.
- [x] 6.7 Check `workflows/docs-and-decisions`, `reference/skills`, `reference/hooks`, `reference/artifacts` and `troubleshooting` against the code and fix what differs; verify the tests of 6.1 pass for the whole site.
- [x] 6.8 Delete `kernel/tests/docs/banner.test.ts` and every banner, update the docs map for every moved page; verify `pnpm test:contract` and `pnpm docs:build` pass and no page under `docs/guide/` contains "Describes BDK v2".

## 7. README v3

- [x] 7.1 Write the failing README content test (one requirements statement, a quick start naming `/bdk:setup` and `/bdk:run`, a link to `getting-started/migration-from-v2`); verify it fails on the current README.
- [x] 7.2 Rewrite `README.md` in the order of docs-site "README v3", moving reference detail to the site (D8); verify the test of 7.1, the v2 workflow guard, drift guards 1 and 6 and `pnpm docs:build` pass.

## 8. Eval documentation

- [x] 8.1 Add drift guard 7 (every directory under `evals/suites/` is named on `contributing/evals.md`); verify it fails while the page is missing.
- [x] 8.2 Write `docs/guide/contributing/evals.md` (D9), add it to the Contributing sidebar group, reduce `evals/README.md` to the synopsis and a link, add the page to the docs map; verify guard 7, the sidebar guard and `pnpm docs:build` pass.

## 9. Plan

- [x] 9.1 Remove the launch of the first Change after v3 (`change new` for `ui-verify`) from the T50 entry of `docs/V3-IMPLEMENTATION-PLAN.md`, citing the user decision of 2026-10-05; verify `ui-verify` is still listed under "After v3.0".

## 10. Acceptance

- [ ] 10.1 Run `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm lint`, `pnpm skill-check` and `pnpm docs:build`; verify all pass, then run `pnpm test:perf` in a Linux container (design D11) and record its result in the PR description.
- [ ] 10.2 Read `docs/V3-ACCEPTANCE.md` and verify every item `S1`-`S8`, `S-DISPATCH` and `S-EVALS` and every `AC`, `TSH` and `EC` item has evidence, and every `open` row names an issue.
- [ ] 10.3 On a clean project, install `bdk-craft` alone and run its `tdd` skill once; verify it runs without `bdk` and record the result in the PR description.
- [ ] 10.4 Open the PR into `staging/v3` and verify CI is green; then run `openspec validate v3-t50-acceptance-docs --strict` and verify it passes.
