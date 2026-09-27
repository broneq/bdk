# Design

## Context

T14 shipped the state contract (`kernel-state`): the Change directory layout, zod schemas for every document, `readDocument` / `writeDocument` / `readChange`, merge-safe ids in `shared/ids` and a merge test on documents written through the store. T11 shipped `shared/store/index-db.ts` as a skeleton (one `meta` table, busy timeout, lazy `node:sqlite` load) and closed the JSON index fallback (T11 D-11). T12 shipped the layered configuration with `overriddenKeys()` and the `config` slice, the first slice with a writing command. Every T20 command (`change new | status | list | resume | park`, `log add | list | show | resolve`, `measure`, `query`) is registered in `schema/cli/commands.json` and answers `kernel/not-implemented`.

What is missing: branch binding and active-Change resolution in the registry (the `kernel-architecture` spec already assigns it to `shared/registry`), the index tables and freshness, entry writing with stamping and dedupe, derived state, the size heuristic, and the four slices.

Sources: design "Change directory", "Ledger entry (K1-K4, R-rule-id)", NFR "Scale" and "Latency", risks "Bottleneck: ledger index" and V1-9; decisions R-store, K1-K4, P1, R-profil, D4b; T02 decisions R-4, R-8, R-12, Q-4.

## Goals / Non-Goals

**Goals:**

- A Change can be opened, inspected, parked, resumed and rebound through the kernel, with every write validated by the T14 schemas.
- `log add` is the only agent-facing write path and cannot forge provenance (P1).
- `log list` stays under 200 ms at 1 000 entries once the index is fresh; 15 parallel `log add` never collide.
- The index is disposable: deleting or corrupting it loses nothing.
- `.gitignore` names exactly `/.bdk/.machine/` and `/.bdk/settings.local.yaml`.

**Non-Goals:**

- The graph (`next`, nodes, gates; T21), attempts and checkpoint (T22), dispatch packages and the observation cap (T23), close and routing (T30, T31), `rebuild` (T22).
- A code-graph `impact` signal for `measure`.
- The later size decisions this Change places elsewhere (D-11): the design split criterion and the `design.md` size limit (T21 validator, T41 skill), the tiny guard on real diffs (T22), `/bdk:cr` reading `bdk measure` (T42).
- Any change to the v2 Python scripts (T32 removes them).

## Decisions

### D-1 Branch binding: one marker file per branch in `.machine/branches/`

`change new` and `change resume` write `.bdk/.machine/branches/<percent-encoded branch>` holding the Change id; the registry reads `HEAD` from the git directory (file system, no process) and the marker for that branch. `shared/git` gains `currentBranch(workTree)` (worktree-aware through the existing `resolveGitDir`), `shared/store` gains the marker paths and `resolveActiveChange`. `createRegistry` takes the resolver as an option, so registry unit tests pass a fake and `main.ts` binds the real one; a Change-scoped handler receives `change: {id, dir, projectRoot, branch}` in its context.

Alternatives: a single `branches.json` map (one shared mutable file, needs read-modify-write under concurrency; per-branch files do not); a `branch` field in `change.md` (committed, so a rename or a second branch mutates a write-once file and conflicts on merge); resolving by `git log` which branch added the Change directory (slow, a process per call, ambiguous after merges). Spawning `git symbolic-ref` per call costs 5-10 ms against the 200 ms budget for no gain over reading `HEAD`.

### D-2 Detached `HEAD` is its own rule for `change new` and `change resume`

A detached `HEAD` cannot be bound. For Change-scoped commands it simply means no active Change (`policy/no-active-change`, `why` says `HEAD` is detached). For the two binding commands a new catalogue rule `policy/detached-head` (exit 2, `instead: git switch <branch>`) says exactly what is wrong. Reusing `policy/no-active-change` or `policy/invalid-transition` would mislead the caller about what to do. Adding a rule id is additive within contract 3.

### D-3 Index: five public tables, internal `_` tables, schema version 2

Tables per the `kernel-state` Rebuildable index requirement. The existing `meta` table becomes `_meta`; `INDEX_SCHEMA_VERSION` becomes 2 and any mismatch drops every table and rebuilds (the index is a cache, so a migration path would be code without a reason). `entries.status` holds the derived status and `superseded_by` is recomputed per Change after a refresh, so `query` users see what `log list` shows. Bodies stay out of the index: `log show` reads the file, keeping the index small and the refresh cheap. `dispatches` is indexed now (T23 writes the files) because `log add --ticket` needs the role, and `attempts` because `change park` and `log add --ticket` need open tickets; the typed queries live in `shared/store` so no slice imports `attempt` (`kernel-architecture`, Dependency matrix).

Code lives in `kernel/src/shared/store/index/` (`schema.ts`, `open.ts`, `refresh.ts`, `queries.ts`), replacing `index-db.ts`.

Alternatives: one table per entry type (every query that spans types becomes a union); a JSON column for all type-specific fields (queries on `severity` or `fingerprint` need `json_extract`, which `query` users should not need); storing bodies (1 000 bodies make the refresh and the file several times larger for a field only `show` reads).

### D-4 Freshness: directory stat fast path, per-file stat slow path, racy-time guard

The fast path (V1-9) stats the Change directory and `log/`, `attempts/`, `dispatch/` (mtime and entry count) and compares them with `_dirs`. Equal means nothing is read. Otherwise the slow path lists the files, compares each with `_files` by inode, mtime and size, and parses only new or changed files; `writeDocument` replaces files by rename, so an in-place `log resolve` changes the inode and the directory mtime even when the count stays. A directory state recorded less than two seconds after its mtime is stored as untrusted and forces the slow path next time (the git "racy clean" rule), which covers file systems with one-second mtime resolution. A full refresh lists `.bdk/changes/` and `.bdk/changes/archive/` (two directory reads) to find new, moved and removed Changes; a Change whose directory moved (archived) is dropped and re-read. Change-scoped commands refresh only the active Change; `change list` and `query` refresh all.

Validation during refresh uses `readDocument`, so a committed file that fails its schema is `state/ledger-invalid` naming it. Duplicate ids surface as a primary-key conflict on `(change_id, id)` and are reported with both paths, the same answer `readChange` gives. The whole refresh is one `BEGIN IMMEDIATE` transaction; the 5 s busy timeout serialises 15 parallel refreshes.

Alternatives: `readChange` of the whole Change on every change (re-parses 1 000 files after each `log add`, several hundred milliseconds); hashing file contents (V1-9 names this as the cost to avoid); a file watcher (no daemon in BDK).

### D-5 Corrupt index: delete and rebuild once, then `state/corrupted-index`

`openIndex` catches an open or pragma failure, deletes the file (and its `-wal` / `-shm` siblings) and retries once; a second failure is `state/corrupted-index` with `instead: bdk rebuild`. The index is a cache, so rebuilding silently is the right default; refusing only when the rebuild itself cannot happen (a directory in the way, a read-only disk) tells the user something they must fix.

### D-6 Entry writing lives in `shared/store`, stamping and dedupe in the `log` slice

`kernel-state` says only `shared/store` builds Change paths, so `shared/store/state/ledger.ts` owns `entryPath` and `writeEntry` (id retry against the `log/` listing, then `writeDocument`). The `log` slice owns the use case `appendEntry` (stamping `id`, `at`, `author`, `source`, `ticket`, `fingerprint`; dedupe), exported through `log/index.ts` and called by `log add` and by the `change` slice for its kernel entries (matrix edge `change -> log`). `appendEntry` accepts the kernel-only own fields (`options`, `park`, `profile`); the `log add` command has no flags for them, which is what keeps them kernel-only.

### D-7 Author from `git var GIT_AUTHOR_IDENT`

One process per writing command (`git var GIT_AUTHOR_IDENT`, trailing timestamp and zone stripped) honours `user.name`, `user.email`, the `GIT_AUTHOR_*` variables and git's own fallbacks exactly as a commit would. When git has no identity (exit 128) the author is `unknown`, so the ledger never blocks on a missing `user.email`; git itself will ask for the identity at the first commit. The commands that stamp an author and did not declare `runtime/git-missing` gain it (`log add`, `change park`, `change resume`).

Alternatives: parsing git config files in `shared/git` (includes, conditional includes and system config make this a reimplementation of git); caching the author in `.machine/` at `change new` (stale after a `git config` change, and different authors share a Change).

### D-8 Dedupe keys

`learning`: the fingerprint, against every `learning` in the Change (the fingerprint already normalises wording, T14 `Fingerprints`). Other types: type, `normalise(summary)`, sorted refs and `supersedes`, only against live entries (`proposed`, `accepted`, not superseded). Matching against resolved entries would swallow a finding that returns after its fix, which is exactly the signal attempts and reviewers need. Including the ticket in the key would let two workers record the same fact twice; excluding it records knowledge, not who said it. The check reads the index, so it costs one query. A race between two identical parallel adds can write both; no lock is taken because the design forbids locks for ids (V1-6 replaced) and a visible duplicate is harmless.

### D-9 Registry changes: repeatable flags, forbidden fields, stdin

- **Repeatable flags.** The index record gains an optional `repeatable: true` on a flag (`commands.schema.json`, `record.ts`); `parse` collects values into an array and `--help` prints `(repeatable)`. Marking by data keeps the rule "a flag is given once" for every other flag.
- **Forbidden fields.** When `parse` meets an undeclared flag named `--id`, `--at`, `--author`, `--source` or `--fingerprint` and the record declares `input/forbidden-field`, the refusal is `input/forbidden-field` instead of `input/unknown-flag`. The alternative, declaring the five flags on `log add` so the handler can refuse them, would put them in `--help` as if they were usable.
- **stdin.** `Runtime` gains `readStdin(): string`; only a handler that needs it calls it (`log add --body -`), so no other command blocks on a terminal.

### D-10 Derived state as a pure function over entry rows

`shared/store/state/derived.ts` computes stage, parked question, superseded map, effective profile and confirmation from a list of entry records (the index rows, or documents in unit tests). The rules are in `kernel-state` (Derived state and mutation). The stage without any transition is `intent`: the Change consists of its intent and nothing has started; T21's graph starts from the `intent` kind. The parked question is recognised by an explicit `park: true` field and a raised profile by an explicit `profile` field on a `decision`, both new optional own fields of the T14 entry schema. Alternatives: recognising a park question by `source: kernel` plus `options` (a main-thread `log add question` is also `source: kernel`, so the rule would rest on the absence of a flag); encoding the profile in `refs` or the summary (string matching on free text). Adding optional fields at schema version 1 is safe: no committed entry carries them yet, and every older kernel is pre-release.

### D-11 Size decisions where their information exists; `measure` returns signals only

"Size" drives three separate decisions, and each is known at a different moment:

| Decision                                                  | Known when                        | Taken by                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1: skip design and plan verification (`tiny`, S7)        | before design, so at `change new` | the calling skill, by an explicit checklist (all true: no new or changed behaviour visible to a user or an API; no change to a data model, schema or configuration; no `spec-impact`; at most 2 files in 1 module); any doubt is `small`. `--profile tiny` requires `--reason`, written into the assumption entry. |
| D2: one `design.md` or parts per subsystem (`large`, R-4) | during design, after exploration  | the `design` skill: split when the design describes at least 3 subsystems with their own interfaces that can be verified separately; the kernel refuses `done design` on a single `design.md` over 12 KB (T21), as S1 does for plan parts. The split writes a `decision` with `profile: large`.                    |
| D3: plan parts                                            | during planning                   | already dynamic: S1 limits every part to 8 KB and 8 tasks; unchanged.                                                                                                                                                                                                                                              |

`change new` therefore does not measure: it records the profile the caller passes, `small` by default. The costs are asymmetric: an undersized `tiny` skips design and plan verification, an oversized `small` costs one short design step. The profile becomes an outcome that only rises (effective profile = the largest of `change.md` and every `decision` carrying `profile`, `kernel-state`), not a prediction made from one sentence.

`bdk measure [<range>]` measures a git diff and returns signals only (`files`, `added`, `removed`, `lines`, `modules`), never a class. Consumers classify: `/bdk:cr` keeps its four classes (tiny < 50 lines, small up to 1 000, large up to 3 000 with one reviewer per 1 000 lines capped at 5, massive above) and may change them without touching `measure`; the tiny guard (T22, on `commit` and `part done` of a `tiny` Change) writes a `finding` with `review: true` when the real diff exceeds 2 files, 1 module or 50 lines, so the user sees it at the review gate. The range follows `git diff`: `<base>` is the working tree against base, which is what `cr` needs for "anchor to head plus uncommitted changes" in one call; `<base>..<head>` is committed history. `.bdk/` is excluded so ledger files never count. Determinism comes from `git diff --numstat` output sorted by path and no clock.

Threshold basis: a size limit exists so one agent (author or verifier) can hold the whole document and the code it names in one pass. The existing reference points are the plan part (8 KB, S1), the dispatch package (12 KB, K4) and the 15-line envelope; a design is denser than a plan part and is read with code alongside, so its limit sits at the package size, not above. All limits are constants; the assumption entry, the split `decision` and the tiny-guard `finding` record the signals in the ledger, so `bdk query` over real Changes shows whether the limits hold, and moving them to settings is a later, additive change.

Alternatives: a kernel heuristic over the intent (word matching against `git ls-files` path segments; the first version of this design) misjudges intents phrased in domain language and predicts D2 before anyone has read the code; a model-estimated profile at `change new` with the skill passing a file list (still predicts D2 and duplicates the design's exploration); no profile at all (every typo goes through design, gate and plan verification, which breaks S7); `measure` returning a profile (its enum cannot hold `cr`'s `massive`, and one matrix would bind both consumers).

### D-12 `query`: read-only connection, one `SELECT` / `WITH`, no allowlist

`PRAGMA query_only = ON` for the duration of the statement makes writes impossible regardless of the SQL text, `WITH ... DELETE` included; it is set on the index connection itself rather than on a second connection opened `readOnly`, because a read-only connection to a WAL database fails when the `-shm` file is missing and an in-memory test database cannot be opened twice; the statement check (`SELECT` or `WITH` first keyword after comments, no second statement after a `;`) gives a clear `input/invalid-argument` instead of SQLite's error. A table allowlist would need an SQL parser or the SQLite authorizer (`setAuthorizer` is not available on Node 22.13), and it protects nothing a read-only connection does not; the documented public tables are the contract and `_` tables are marked internal. Column names come from `StatementSync.columns()` where Node has it and from the first row's keys otherwise (Node 22.13 to 22.15).

### D-13 `ensureIgnored` in `shared/store`, called by `change new` and `config set`

`git check-ignore --no-index -q` per path decides whether a rule already covers it (in any `.gitignore`, `.git/info/exclude` or the global excludes file); only uncovered paths are appended to `<projectRoot>/.gitignore`, each on its own line, after a scan of the file so a line is never repeated. Without git on `PATH` (a case only `config set` can reach), the scan alone decides. `config set` is included because `/bdk:setup` runs it first and it creates `.bdk/settings.local.yaml` and `.bdk/.machine/config/`. The v2 behaviour, ignoring `/.bdk/` whole, would hide committed Change directories and is exactly what the plan names as the bug.

### D-14 T21 / T22 fields until those tasks land

`change new` and `change resume` omit `next` (schema: optional, described as absent until T21), `change status` returns `nodes: []`, `gates: []`, `parts: []`, and `change park` returns `checkpoint: {done: false, skipped: "change checkpoint lands with T22"}`. Emitting a guessed `next` would encode graph knowledge in the `change` slice that T21 owns; making it required again is T21's amendment. The `change list` `branch` field becomes optional for Changes without a local marker, which is a real state after a clone, not a placeholder.

### D-15 CLI output schemas generated from zod

The ten T20 commands get zod output schemas in their slices, and `export-schemas.ts` generates `schema/cli/output/<id>.json` from them (D-10 of `v3-t12-layered-config`), replacing the hand-written files. The examples move into the zod `meta`, updated to eight-character ids and the T14 entry file name.

### D-16 `shared/vocabulary`: one home for the state value lists

The entry types, statuses, profiles, change kinds and sources, provenance values and ticket scopes were copied into `shared/store` and into the `domain/` of `log` and `change`, with unit tests keeping the copies equal. A copy that drifts still passes every other test. They now live once in `shared/vocabulary`, plain constants with no import. `kernel-architecture` lets `domain/`, `render/` and `schema/` read it, and the import scan keeps it free of imports so the pure layers stay pure. Alternative rejected: re-exporting the lists from `shared/store`, which would make the pure layers depend on the file system boundary.

## Risks / Trade-offs

- [Parallel refreshes serialise on `BEGIN IMMEDIATE`] 15 agents adding entries at once each refresh the index; with a 5 s busy timeout and refresh work of a few milliseconds per new file the queue drains well within budget. Measured in the 15-writer E2E.
- [`node:sqlite` API gaps on 22.13] `columns()` and `setReturnArrays` are missing there; the fallback uses row keys, which collapses duplicate column names in `query` output. Documented; CI runs 22.13.
- [Dedupe race] Two identical parallel adds may both write; accepted (D-8).
- [Author `unknown`] A machine without a git identity records `unknown`; visible in the ledger, fixed by configuring git.
- [A wrong `tiny` skips design] The calling skill judges D1 by a checklist; `--reason` puts the justification in the ledger and the T22 tiny guard flags a real diff over the `tiny` limits at the review gate. Until T22 lands, the guard does not exist.
- [`large` appears late] The graph learns about a split only at design time; T21 must recompute nodes after the `decision` entry. Accepted: the information does not exist earlier.
- [Markers are local] A fresh clone must run `change resume <id>`; the `no-active-change` refusal lists the candidate ids.

## Migration Plan

No user data exists in v3 format yet. The index schema version bump drops the T11 skeleton table. The entry schema stays at version 1 (new optional fields only). Rollback is reverting the PR; `.machine/` is disposable.

## Open Questions

None blocking. Calibration of the size limits (12 KB design, the `tiny` limits, `cr`'s classes) and a settings key for them are left for when real Changes provide data.
