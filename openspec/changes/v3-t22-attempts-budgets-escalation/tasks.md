# Tasks

## 1. Start

- [x] 1.1 Confirm issue #54's card is "In progress" on the project board (`gh project item-list 1 --owner broneq --format json`); verify the item's `status` reads `In Progress`
- [x] 1.2 Record the T22 resolutions in `docs/V3-IMPLEMENTATION-PLAN.md` (design D-16): the T22 section points each "To resolve in the spec" item to this Change; the T23 row (placeholder refusal at `dispatch build`, `policy/stale-evidence` and `policy/missing-citation` at `attempt close`, P8 downgrade and observation cap in `log ingest`, `policy.verifier` and `policy.log` as per-subtree modules), T24 row (`hooks session-end` calls the `shared/store` checkpoint, session ids for `change takeover`, `pre-tool` deny list for `commit|attempt|part`), T30 row (`policy.checkpoint.squash-at-close`, default off) and T41 row (task grammar for the `/bdk:plan` template, `change resume --option` answers a ladder question, `attempt close` `next.action` values); verify every item points to this Change

## 2. Contract: specs, index, catalogue and state schemas

- [x] 2.1 Sync this Change's deltas into the main specs (`openspec sync` or by hand, as T20 and T21 did) so the contract tests read the amended text; update `schema/cli/commands.json` (`attempt open` synopsis and `--escalate`, the rule lists of `attempt open`, `part start`, `commit`, `change checkpoint`, `change takeover`, the `writes` of `attempt open`, `attempt close`, `change park`, `change takeover`) and the `shared/refusal` catalogue data (`policy/git-hook-failed`, new emitters); verify `pnpm test:contract` passes
- [x] 2.2 Write failing state tests: an attempt record with `loop: task-escalation` fails naming `loop`; each of the four loops validates; a `question` with `park: true` from a kernel writer validates; the state fixture gains an escalation record and a ladder question
- [x] 2.3 Restrict `loop` to the four loops in `shared/store/state/attempt.ts`, update the `park` and `input-hash` field descriptions in `entry.ts`, regenerate `schema/state/`, extend the state fixture; verify 2.2 and `pnpm test:contract` pass

## 3. shared/config: one root, several modules

- [x] 3.1 Write failing tests in `shared/config/tests/registry.test.ts` and `kernel-settings` contract tests: modules `policy.gates` and `policy.budgets` compose one strict `policy` object; `policy` plus `policy.gates` and two modules with the same key fail at startup; an unknown key under `policy` answers `policy/unknown-config-key` with the edit-distance hint; `policy.checkpoint.squash-at-close` inside the registered `policy.checkpoint` answers `lands with T30`; `policy.log.max-observations` answers `lands with T23`; the JSON Schema export holds the composed `policy` object
- [x] 3.2 Implement dotted module keys in `createConfigRegistry` and the key tree; move `graph`'s module to `policy.gates`; add `attempt/config.ts` (`policy.budgets`, `policy.oscillation`, `policy.escalation` with `per-change`) and `shared/store/config.ts` (`policy.checkpoint.enabled`, consumer `shared/store`); update `PLANNED_KEYS` (remove T22's keys, `squash-at-close` owned by T30) and `settingsRegistry()`; regenerate `schema/settings`; verify 3.1, the existing config and graph tests and `pnpm test:contract` pass
- [x] 3.3 Update the `docs/guide/` configuration reference for the `policy` keys and their consumers; verify `pnpm docs:build` passes

## 4. shared/git and shared/store primitives

- [x] 4.1 Write failing unit tests for `shared/git` on temporary repositories: working-tree changes against `HEAD` with untracked files and without `.bdk/`; trailer commits of a Change read through `--grep` with hash, `BDK-Part`, `BDK-Task`; a pathspec commit that leaves another staged file staged; a failing `pre-commit` hook reported with its first output line and `HEAD` unchanged; `runtime/git-missing` without git
- [x] 4.2 Implement the `shared/git` functions; verify 4.1 passes
- [x] 4.3 Write failing unit tests for the plan task grammar in `shared/store/state/tests/plan-tasks.test.ts`: headings and ids, `Files:` items with and without `Create:`/`Modify:`/`Test:`/`Delete:`, `Test cases:` versus `Verification: none`, `Depends on:`, `Stop rule:`, free text ignored, duplicate ids, every placeholder form of `kernel-state` (`TODO`, `TBD`, `FIXME` as words but not inside `TODOS`, `<fill in>`, `[...]`, `...` alone, a bracketed title) and no false positive on `...` inside a sentence
- [x] 4.4 Implement the parser and the placeholder check in `shared/store/state/plan.ts`; verify 4.3 passes
- [x] 4.5 Write failing unit tests for the `shared/store` cores: trailer progress per task and the four `state/trailer-mismatch` cases naming both sides; `checkpointChange` returns `done` with the commit, and `skipped` for disabled policy, nothing changed, rebase in progress, open ticket and a failing hook, never sweeping a user-staged file; `rebuildChanges` rebuilds the index, migrates an older document through a test migration, lists a newer document in `warnings`, regenerates both indexes byte-identically and counts entries, attempts and commits
- [x] 4.6 Implement the three cores in `shared/store` and export them; verify 4.5 and the existing store tests pass

## 5. graph: done markers and part checks

- [x] 5.1 Write failing tests in `graph/tests/`: a kernel `transition` without `input-hash` leaves a node `ready` (engine); `execute-part` hashes its plan part file, fails its check naming a task without a trailer commit and an open ticket, passes when all tasks are committed; the `plan-part` checks `size` (8 192 passes, 8 193 fails), `tasks` (0 and 9 fail), `do-not-touch`, `placeholder`, `grammar`, `spec-impact` without its `spec-delta/` file; `validate plan-part:02` in text mode exits 2 with the mapped rule for each check; `done plan` answers `policy/validation-failed` naming the checks; the extensibility test still passes
- [x] 5.2 Implement the done-marker rule in `graph/domain/engine.ts`, the checks in the `PlanPartKind` and `ExecutePartKind` classes, trailer and open-ticket facts on `ChangeView` loaded by the graph use cases, and the check-to-rule map of `validate`; export from `graph/index.ts` what `part` needs (kind checks, the done writer); verify 5.1 and all existing graph and change tests pass
- [x] 5.3 Update `graph/tests/graph.e2e.ts`: replace the T22 notes with real cases for `policy/part-too-large`, `policy/part-too-many-tasks`, `policy/do-not-touch-overlap` and `policy/placeholder` through `validate`; verify `pnpm build && pnpm test:e2e` passes for the file

## 6. part slice

- [x] 6.1 Write failing unit tests in `part/tests/` for `diffCheck` (task, part, Change and verifier targets; forbidden path with path and glob; undeclared path; a sibling's declared path not flagged; a committed sibling's path flagged) and for `part list` (states `blocked`, `ready`, `started`, `done`, `stale`; `done` counts from trailers; oversized part listed; wave), `part start` (not-ready naming the requirement, each check's rule, invalid-transition when started or done, the start marker without `input-hash`, stage `execute`), `part done` (not started, open ticket, task without commit, trailer mismatch, done marker with the part hash, open findings listed, `next`, tiny guard finding once), `part split` (new id, moved ids kept, frontmatter copied with the title suffix, dependents extended, index regenerated, decision entry, `plan-verify` stale, refusals for a done part, a committed task, all tasks moved, an open ticket)
- [x] 6.2 Implement the `part` slice (commands, use-cases, domain, render, zod output schemas with `bytes` uncapped, `index.ts` exporting `diffCheck`), register it, add the schema lines to `kernel/scripts/export-schemas.ts`; verify 6.1 passes and `pnpm build` regenerates `schema/cli/output/part-*.json` with only the documented shape changes
- [x] 6.3 Write `part/tests/part.e2e.ts` through the bundle on repository fixtures: one case per exit code and per declared rule of the four records, outputs validated against their schemas; verify it passes
- [x] 6.4 Run `/docs-sync` for `part list|start|done|split` and the plan part format: per `.claude/skills/docs-sync/references/docs-map.md` the v3 commands live in `README.md` until T50 (the `docs/guide/` site describes v2 under its banner), so add a Plan parts section there and a docs-map row; verify `pnpm docs:build` passes

## 7. attempt slice

- [x] 7.1 Write failing unit tests in `attempt/tests/` for the ladder as pure functions over records and entries: rounds (an answering decision opens a new round), `attempt` and `of`, budget 0, `not-run` counter consecutive and reset by `ok`/`fail`, scopes per attempt number, dropped findings, fingerprints from the first file ref (entries without one skipped), oscillation over non-consecutive records with the threshold, every row of the `next.action` table, escalation availability (disabled, used in the round, `per-change` reached), the default ladder options
- [x] 7.2 Write failing use-case tests for `attempt open` (not-found, invalid loop and target pairing, not-ready before `part start`, ticket-open for the same key and not for a sibling, budget-exhausted and oscillation with `instead`, `--escalate` allowed and its `policy/invalid-transition` cases, `escalation.model`, the dropped-findings entry, the checkpoint before an escalation ticket, the race rule removing its own record), `attempt close` (no-open-ticket, not-found, do-not-touch leaving the ticket open, undeclared finding, entries-missing naming ids, not-run without `--reason`, fingerprints stored, the ladder question with `park: true`, options and `refs`, checkpoint after it, `next` for each outcome) and `attempt list` (open first, `--for` a part includes its tasks, `--all`, budgets, `entries` counter)
- [x] 7.3 Implement the `attempt` slice (commands, use-cases, domain, render, zod output schemas) and register it; add the schema lines to `kernel/scripts/export-schemas.ts`; verify 7.1 and 7.2 pass and `pnpm build` regenerates `schema/cli/output/attempt-*.json` with only the documented shape changes
- [x] 7.4 Write `attempt/tests/attempt.e2e.ts` through the bundle: one case per exit code and per declared rule of the three records (`policy/stale-evidence` and `policy/missing-citation` noted as T23's cases), outputs validated against their schemas, a hand-written dispatch package fixture where a ticket needs a role; verify it passes
- [x] 7.5 Run `/docs-sync` for the `attempt` commands and the escalation ladder: until T50 rewrites the site the v3 behaviour is documented in `README.md` (docs-map), so add its Loops and attempts section (budgets, `not-run`, oscillation, escalation, parking, answering with `change resume`) and the docs-map row; verify `pnpm docs:build` passes

## 8. commit slice

- [x] 8.1 Write failing tests in `commit/tests/`: staging of declared, undeclared and Change-directory paths; the three trailers read back with `git log`; a user-staged file left staged and outside the commit; do-not-touch, git-in-progress, git-hook-failed with `HEAD` unchanged, nothing-to-commit, ticket-open of the task, not-found; the undeclared finding; the tiny guard finding over 2 files and no second entry for the same numbers
- [x] 8.2 Implement the `commit` slice and register it; add its schema line; verify 8.1 passes
- [x] 8.3 Write `commit/tests/commit.e2e.ts` through the bundle: one case per exit code and declared rule, output validated against `schema/cli/output/commit.json`; run `/docs-sync` for `bdk commit`: until T50 the v3 behaviour is documented in `README.md` (docs-map), so add its row to the Plan parts command table and extend the docs-map row; verify the E2E and `pnpm docs:build` pass

## 9. log ingest

- [x] 9.1 Write failing tests in `log/tests/`: a whole report and a bare block; zero or two blocks and a non-sequence block refused; each forbidden field naming its line; a wrong `type` naming item, field and line in a report whose block starts mid-file; `type: transition` refused; nothing written on any refusal; provenance `agent:<role>` and `ticket` from the dispatch package; dedupe; a stdin report stored at the package's `report` path and a `--file` report not copied; `no-open-ticket` for a closed ticket and a ticket without a package
- [x] 9.2 Implement `log ingest` with the YAML node ranges for line numbers and register the handler; verify 9.1 passes
- [x] 9.3 Add `log ingest` cases to `log/tests/log.e2e.ts` (exit codes and declared rules; `policy/observation-cap` noted as T23's case); run `/docs-sync` for `log ingest` and the `bdk-entries` block; verify the E2E and `pnpm docs:build` pass

## 10. change slice

- [x] 10.1 Write failing tests in `change/tests/`: `change checkpoint` (commit with the subject and only Change paths, `skipped` when disabled or unchanged, refusals for git-in-progress, ticket-open and git-hook-failed); `change park` reporting a real checkpoint and a skip without failing; `change takeover` (invalid-transition without open tickets naming `bdk rebuild`, ticket-open without the flag, closing tickets as `not-run` with body `taken over`, the transition entry, the rebuild, budgets kept); `change status` filling `parts` equal to `part list` and staying within 100 lines with 8 parts
- [x] 10.2 Implement `checkpoint` and `takeover` through the `shared/store` cores, the park checkpoint and the status parts; remove `CHECKPOINT_SKIPPED`; register the handlers; verify 10.1 and the existing change unit and E2E tests pass
- [x] 10.3 Add E2E cases for `change checkpoint` and `change takeover` (exit codes and declared rules) to `change/tests/change.e2e.ts`; run `/docs-sync` for both commands and the status `parts`; verify the E2E and `pnpm docs:build` pass

## 11. service: rebuild

- [x] 11.1 Write failing tests in `service/tests/`: `bdk rebuild` on the active Change and with `--all`, the counts, `migrated`, `warnings` for a newer document, `state/trailer-mismatch` with both sides while the index and indexes are still written, `policy/no-active-change` without `--all`
- [x] 11.2 Implement `rebuild` in the `service` slice over the `shared/store` core and register it; verify 11.1 passes
- [x] 11.3 Add E2E cases for `rebuild` to `service/tests/service.e2e.ts`; run `/docs-sync` for `bdk rebuild` as the repair path; verify the E2E and `pnpm docs:build` pass

## 12. Acceptance

- [x] 12.1 Write `attempt/tests/acceptance.e2e.ts` on repository fixtures through the bundle, one case per item of the T22 acceptance signal: budget exhaustion ends in a parked Change with a `question` entry and options; oscillation on a fixture shortens the ladder while budget remains; `attempt close not-run` three times leaves the loop budget unused and creates the question; a diff touching `do-not-touch` is rejected at `attempt close`; a killed session (open ticket, deleted `.bdk/.machine/`, fresh clone) plus `change resume` and `rebuild` reconstructs part progress and attempts with the same budgets; a checkpoint leaves a user-staged file out of its commit; a 9 KB part is refused by `part start` with `policy/part-too-large`; a `bdk-entries` block with a wrong type is refused with its line number; verify it passes
- [x] 12.2 Run `pnpm build` then `git diff --exit-code dist/ schema/`; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`; `pnpm test:unit` (coverage thresholds), `pnpm test:e2e`, `pnpm test:contract`, `pnpm test:perf`, `pnpm skill-check`, `pnpm docs:build`; verify all pass
- [x] 12.3 Run `openspec validate v3-t22-attempts-budgets-escalation --strict`; verify it is valid
