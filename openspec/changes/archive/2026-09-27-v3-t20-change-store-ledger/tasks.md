# Tasks

## 1. Start

- [x] 1.1 Move issue #52's card to "In progress" on the project board; verify with `gh project item-list 1 --owner broneq --format json`
- [x] 1.2 Record the T20 resolutions in `docs/V3-IMPLEMENTATION-PLAN.md` (T20 section: size decisions per D-11 instead of an intent heuristic, `measure` as diff signals only, the acceptance item "`measure` returns the same profile for the same intent" reworded to "the same output for the same range", dedupe keys, no `query` allowlist, index tables; T21 row: `next` in `change new` / `change resume`, the `change status` graph fields, the 12 KB `design.md` limit on `done design` and recomputing nodes after a `profile` decision; T22 row: `change park` checkpoint and the tiny guard on `commit` / `part done`; T41 row: the `change` skill's D1 checklist and the `design` skill's split criterion; T42 row: `/bdk:cr` reads `bdk measure`); verify the T20 "To resolve in the spec" items each point to this Change

## 2. Contract: index, rules and schemas

- [x] 2.1 Extend `schema/cli/commands.schema.json` and `shared/registry/record.ts` with the optional flag attribute `repeatable`; mark `log add --ref` and `change park --option`; add `policy/detached-head` to the rule enum in `shared/refusal`, the catalogue and `change-new` / `change-resume`; on `change-new` add `--reason`, reword `--profile` and the summary, drop `policy/profile-downgrade`; replace the `measure` record's `<intent>` and `--diff` with an optional `<range>` and reword its summary; add `runtime/git-missing` to `log-add`, `change-park`, `change-resume`, `input/not-found` to `log-add`, `.gitignore` to the `writes` of `change-new` and `config-set`; verify `pnpm test:contract` fails only on the missing main-spec text
- [x] 2.2 Sync this Change's deltas into the main specs (`openspec sync` or by hand, as T14 did at archive time) so the contract tests read the amended requirements; verify `pnpm test:contract` passes

## 3. Registry: repeatable flags, forbidden fields, stdin, active Change

- [x] 3.1 Write failing unit tests in `shared/registry/tests/registry.test.ts`: a repeatable flag collects values in order and a non-repeatable one given twice is `input/invalid-argument`; `--source user`, `--source=user`, `--author x`, `--id`, `--at`, `--fingerprint` on a record declaring `input/forbidden-field` answer exit 3 `input/forbidden-field`, on another record `input/unknown-flag`; `--help` prints `(repeatable)`; a Change-scoped record gets `change` in its context from the injected resolver, and the resolver's refusals (`policy/no-active-change`, `state/change-dir-missing`) are returned unchanged; `readStdin` is only called by the handler
- [x] 3.2 Implement in `parse.ts`, `help.ts`, `run.ts` (`createRegistry(index, registrations, {activeChange})`, `Runtime.readStdin`); verify 3.1 passes

## 4. shared/git: branch and author

- [x] 4.1 Write failing unit tests in `shared/git/tests/git.test.ts`: `currentBranch` returns `feat/login` for `ref: refs/heads/feat/login`, undefined for a detached `HEAD`, follows a worktree's `.git` file; `authorIdent` strips the timestamp from `git var GIT_AUTHOR_IDENT`, returns `unknown` on exit 128 and refuses `runtime/git-missing` without git
- [x] 4.2 Implement both in `shared/git/index.ts`; verify 4.1 passes

## 5. shared/store: paths, markers, ignore, ledger writer, derived state

- [x] 5.1 Write failing unit tests: Change paths and `entryPath` (`log/<ts>-<type>-<id>.md`); marker write, read and percent-encoding, `resolveActiveChange` (no marker, detached `HEAD`, missing directory, archived Change, marker of another branch); `ensureIgnored` (empty repository, existing lines, a rule in `.git/info/exclude`, no git), `writeEntry` retrying an id already present in `log/`; `derived.ts` for stage (`intent` without transitions, ties by id), parked (park question, resume decision), superseded, effective profile, confirmation
- [x] 5.2 Add the `park` (question) and `profile` (decision) own fields to `shared/store/state/entry.ts`, regenerate `schema/state/entry.json`, add both to the state fixture; verify the state contract tests pass
- [x] 5.3 Implement `shared/store/changes.ts`, `ignore.ts`, `state/ledger.ts`, `state/derived.ts`; verify 5.1 passes

## 6. shared/store: the index

- [x] 6.1 Write failing unit tests in `shared/store/tests/index.test.ts` on temporary directories: schema version 2 and a version mismatch rebuild; refresh indexes `change.md`, entries with refs, attempts and dispatch packages; derived `status` and `superseded_by`; fast path reads no file when nothing changed; an in-place rewrite and a removed file are picked up; racy-time guard; invalid file and duplicate id refuse `state/ledger-invalid` naming the files and leave the index unchanged; a garbage index file is rebuilt; an index path that is a directory refuses `state/corrupted-index`; typed queries (entries with filters and `--for`, entry by id, open tickets, ticket role, Changes for `change list`); the read-only query connection rejects writes
- [x] 6.2 Implement `shared/store/index/` (`schema.ts`, `open.ts`, `refresh.ts`, `queries.ts`) replacing `index-db.ts`; update `service` (`doctor` schema checks) if it reads the old table; verify 6.1 and the existing store and service tests pass

## 7. measure slice

- [x] 7.1 Write failing unit tests in `measure/tests/measure.test.ts` on injected numstat output: files, added, removed and lines summed, a binary file counted with zero lines, modules as the first two directory segments and the file name for a root file, sorted and distinct, paths under `.bdk/` excluded, renamed paths (`a => b`, `{a => b}/c`) counted once under the new path, identical output for identical input in any order; range parsing (`<base>`, `<base>..<head>`, default `HEAD`, malformed range and unknown ref `input/invalid-argument`)
- [x] 7.2 Implement `measure/` (commands, use-cases with `git diff --numstat` through `shared/git`, domain aggregation, render, zod schema); register it; add the schema line to `export-schemas.ts`; verify 7.1 passes

## 8. log slice

- [x] 8.1 Write failing unit tests in `log/tests/` for `add` (stamping, source `kernel` without ticket and `agent:<role>` with an open ticket and package, `policy/no-open-ticket`, `--status superseded` and `routed` refused, `--supersedes` not found, summary over 120, no ref, `learning` fingerprint, dedupe for live entries and not for resolved ones, `--body -` from stdin), `list` (filters, `--for` semantics, derived status, ordering, page cap, telemetry line and trimming), `show` (bare, qualified, archived Change, not found, malformed id, `supersededBy`), `resolve` (every allowed and refused move, `superseded` writes `supersedes` into the `--by` entry, `--by` missing or already superseding, reason appended to the body)
- [x] 8.2 Implement `log/` (commands, use-cases, domain, store, render, zod schemas, `index.ts` exporting `appendEntry`); register it; add the four schema lines to `export-schemas.ts`; verify 8.1 passes

## 9. change slice

- [x] 9.1 Write failing unit tests in `change/tests/` for `new` (id and slug, `change` fallback slug, directory exists, active Change on the branch, detached `HEAD`, default `small` profile with `defaulted: true` and its assumption entry, `--profile tiny` without `--reason` refused `input/missing-argument` with no file written, `--profile tiny|large` with `--reason` as the entry body, no `policy/profile-downgrade` from `new`, `--kind bug`, `--inferred`, overridden keys, marker and `.gitignore` written), `status` (derived fields, `confirmed`, parked block, empty graph arrays, text at most 100 lines), `list` (union of directories and markers, `--all`, states, `updatedAt` order), `resume` (parked with option, option out of range, option on a live Change, rebind from another branch and from none, profile raise, equal, downgrade, already bound, archived, branch bound elsewhere), `park` (defaults, reason summary, already parked, open ticket, checkpoint skipped)
- [x] 9.2 Implement `change/` (commands, use-cases, domain, render, zod schemas, `index.ts`); `change new` resolves the configuration for `overriddenKeys` and calls `ensureIgnored`; register it; add the five schema lines to `export-schemas.ts`; verify 9.1 passes

## 10. query slice and config set

- [x] 10.1 Write failing unit tests for `query` (columns and rows, page cap and `--all`, `SELECT` / `WITH` only, a second statement refused, SQLite error as `input/invalid-argument`, refresh of every Change) and for `config set` calling `ensureIgnored`
- [x] 10.2 Implement `query/` and the `config set` change; register `query`; add its schema line; verify 10.1 passes

## 11. E2E through the bundle

- [x] 11.1 Write `change/tests/change.e2e.ts`, `log/tests/log.e2e.ts`, `measure/tests/measure.e2e.ts`, `query/tests/query.e2e.ts` on repository fixtures: one case per exit code and per declared rule of each record (git removed from `PATH` for `runtime/git-missing`; `policy/observation-cap` is T23's and stays untested here, noted in the file), every output validated against its schema; run `pnpm build` first
- [x] 11.2 Acceptance cases: 15 parallel `log add` without id collisions and without locks; `log list` under 200 ms at 1 000 entries on the second run, with its telemetry line; `log add --source user` exit 3 with no file written; `change status` at most 100 lines and an `--inferred` Change shown unconfirmed; the index deleted and rebuilt with identical `log list` output; `measure <base>` twice with byte-identical output; the fixture `.gitignore` holds exactly two `.bdk` lines
- [x] 11.3 Rewrite `kernel/tests/contract/state-merge.test.ts`'s first scenario on kernel output (`change new`, `log add`, `log resolve`, `change park` / `change resume` on branches A and B, merge, every file validates, `log list --all` lists each entry once), keeping the same-rule conflict case; verify it passes
- [x] 11.4 Remove the T20 records from the stub enumeration expectations where needed and confirm `kernel/tests/contract.e2e.ts` no longer lists them

- [x] 11.6 Move the state value lists into `shared/vocabulary` (design D-16); `shared/store`, `log` and `change` import them; the import scan allows `shared/vocabulary` in `domain/`, `render/` and `schema/` and forbids any import inside it, each rule with a negative control

## 12. Documentation

- [x] 12.1 Run `/docs-sync` for the new commands, the `.gitignore` behaviour and the index; update `docs/guide/` pages that describe the Change directory and the kernel commands; verify `pnpm docs:build` passes

## 13. Acceptance

- [x] 13.1 Check the Acceptance signal end to end: `pnpm build` then `git diff --exit-code dist/ schema/` is clean; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit` (coverage thresholds), `pnpm test:e2e` and `pnpm test:contract` pass; each acceptance item of T20 maps to a passing case of 11.2 or 11.3
- [x] 13.2 Run `openspec validate v3-t20-change-store-ledger --strict`; verify it is valid
