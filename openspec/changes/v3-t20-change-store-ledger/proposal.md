# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T20. Tracks #52.

T14 fixed what a Change looks like on disk, but no command creates one yet: every `change` and `log` verb is still a `kernel/not-implemented` stub, the SQLite index is a skeleton with one `meta` table, and nothing binds a Change to a branch. T21 (graph), T22 (attempts, commit) and T24 (gates) all write and read ledger entries through a store that does not exist. T20 makes the Change a durable on-disk object with an append-only ledger, `shared/store` as its single access point and a rebuildable index, so every later task has something real to build on.

## What Changes

- **`change` slice**: `change new | status | list | resume | park` implemented. `change new` creates `.bdk/changes/<id>/change.md` (written once), records the starting profile passed by the calling skill (`small` by default, `tiny` only with `--reason`) as an `assumption` entry and the D4b overridden keys, and binds the Change to the current branch. `--kind bug` takes the reproduction as intent (R-8); `--inferred` stamps `source: inferred`, shown as unconfirmed by `change status` until a `source: user` transition exists (R-12).
- **`log` slice**: `log add | list | show | resolve` implemented. `id`, `at`, `author`, `source` and the `learning` fingerprint are kernel-stamped (P1); `--source` and the other stamped fields are `input/forbidden-field` (exit 3), so `source: user` is unreachable. One file per entry, validated by the T14 schemas; dedupe by key; `observation` cap field only (enforced in T23).
- **`measure` slice**: `bdk measure [<range>]`, deterministic signals of a git diff (files, lines, modules) with no class or profile; each consumer classifies with its own thresholds (`/bdk:cr` its four classes, the T22 tiny guard the `tiny` limits).
- **`query` slice**: `bdk query <sql>`, read-only SQL over the index.
- **`shared/store`**: the rebuildable SQLite index (`node:sqlite`, busy timeout) with public tables `changes`, `entries`, `refs`, `attempts`, `dispatches`; lazy refresh by `stat` of the Change's `log/`, `attempts/` and `dispatch/` directories plus file count, per-file reparse only after a change (V1-9); a deleted or corrupt index rebuilt from the files. Branch markers in `.bdk/.machine/branches/`, path builders for entries, derived state (stage, parked, superseded, effective profile), `ensureIgnored` for `.gitignore`.
- **`shared/registry`**: resolves the active Change for Change-scoped records (`policy/no-active-change`, `state/change-dir-missing`), accepts repeatable flags the index marks, maps a kernel-stamped field passed as a flag to `input/forbidden-field`, and reads stdin for `--body -`.
- **`shared/git`**: current branch from `HEAD` (file system, no spawn) and the author identity (`git var GIT_AUTHOR_IDENT`).
- **Fix `ensure_ignored()`**: the kernel writes exactly `/.bdk/.machine/` and `/.bdk/settings.local.yaml` into the project `.gitignore` (never `/.bdk/`), probing `git check-ignore` first; `change new` and `config set` call it. The v2 Python `ensure_ignored()` stays until T32 removes the scripts.
- **CLI contract amendments** (spec deltas plus `schema/cli/` in the same PR):
  - new rule `policy/detached-head` for `change new` and `change resume`;
  - `runtime/git-missing` added to `log add`, `change park`, `change resume` (they stamp the git author); `input/not-found` added to `log add` (`--supersedes`);
  - `repeatable` flag attribute in the index for `log add --ref` and `change park --option`;
  - `next` in `change new` / `change resume` becomes optional until the graph lands (T21); `branch` in `change list` becomes optional (a Change without a local marker);
  - `change status` returns empty `nodes`, `gates`, `parts` until T21 / T22; `change park` reports the checkpoint as skipped until T22;
  - `config set` writes `.gitignore` through `ensureIgnored`;
  - `change new` no longer measures: `--profile` sets the starting profile (default `small`), new flag `--reason` (required with `--profile tiny`), `policy/profile-downgrade` stays on `change resume` only, the output's `profile` carries `defaulted` instead of `measured` / `overridden`;
  - `bdk measure [<range>]` replaces `bdk measure [<intent>] [--diff <ref>]`; its output holds signals only (`range`, `files`, `added`, `removed`, `lines`, `modules`), without `profile`, `signals` or `impact`;
  - examples use eight-character ids and the T14 entry file name.
- **`kernel-state` amendments**: `question` gains `park` and `decision` gains `profile` (kernel-set own fields that make "parked" and "profile raised" derivable without guessing); the stage without any `transition` is `intent`; new requirements for the index, branch binding, deduplication and ignored paths.

Resolutions of the plan's "To resolve in the spec" (details and rejected alternatives in design.md):

- **Profile heuristic and thresholds**: no kernel heuristic over the intent. Each size decision is taken where its information exists: `tiny` (skip design) by the calling skill at `change new` against an explicit checklist, `small` by default, `--reason` required for `tiny`; the design split (`large`) by the `design` skill when the design covers at least 3 subsystems with their own interfaces, backed by a 12 KB limit on a single `design.md` (T21, T41); plan parts stay dynamic under S1. A `tiny` Change whose real diff exceeds 2 files, 1 module or 50 lines gets a `finding` with `review: true` (T22).
- **Dedupe key per entry type**: `learning` by fingerprint against every `learning` of the Change; every other type by type, normalised summary, sorted refs and `supersedes`, matched only against live (`proposed` or `accepted`, not superseded) entries, so a finding that returns after it was resolved is recorded again.
- **Table allowlist for `query`**: none enforced. The public tables are the contract; internal tables start with `_` and may change. Read-only is enforced by a read-only connection and a single `SELECT` / `WITH` statement.
- **Index schema**: the five public tables above plus `_meta`, `_files`, `_dirs`; schema version 2, a version mismatch drops and rebuilds.
- **What `measure` reads**: only `git diff --numstat` for a range (`<base>` = working tree against base, which covers `cr`'s anchor-to-head plus uncommitted changes; `<base>..<head>` = committed history), excluding `.bdk/`. `change new` does not call it. `impact` stays absent until a code-graph source exists.

Inputs carried by citation: design "Change directory (knowledge committed, machine state local)", "Ledger entry (K1-K4, R-rule-id)", Constraints & NFRs "Scale" and "Latency", risks "Bottleneck: ledger index" and "Hidden cost: index freshness check on every call (V1-9)"; decision register R-store, K1-K4, P1, R-profil, D4b; T02 decisions R-4, R-8, R-12, Q-4 (`docs/V3-SKILL-INVENTORY.md`); T11 design D-11 (no JSON index fallback, which closes the plan's escape hatch); specs `kernel-state`, `kernel-cli` and its groups `change`, `log`, `query`, `config`, `kernel-architecture`.

Out of scope:

- `change takeover`, `change checkpoint` (T22), `change close`, `log route` (T30 / T31), `log ingest` (T22), `rebuild` (T22). `change park` calls no checkpoint until T22 lands it.
- The artifact graph behind `change status` nodes and gates and the `next` artifact (T21); the per-dispatch `observation` cap and the role of a ticket beyond its dispatch package (T23); attempt records themselves (T22, only read here for `policy/ticket-open` and `--ticket`).
- `impact` from a code graph; calibration of the size limits.
- The design split criterion and the 12 KB `design.md` limit (T21 validator, T41 `design` skill), the tiny guard on `commit` / `part done` (T22), `/bdk:cr` switching to `bdk measure` (T42).
- Removing the v2 Python `ensure_ignored()` (T32).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-state`: Ledger entry (`park`, `profile` own fields), Derived state and mutation (stage `intent` without transitions, parked and profile rules made explicit), new requirements Rebuildable index, Branch binding, Ledger deduplication, Ignored paths; Two-branch merge gains the scenario on kernel output.
- `kernel-cli`: Invocation (repeatable flags, stdin for `log add --body -`, detached HEAD), Exit codes and the error object (rule `policy/detached-head`; `runtime/git-missing` and `input/not-found` emitters).
- `kernel-cli/change`: `change new`, `status`, `list`, `resume`, `park`, `measure` implemented by T20 with their behaviour, rules and schemas.
- `kernel-cli/log`: `log add`, `list`, `show`, `resolve` implemented by T20.
- `kernel-cli/query`: `query` implemented, public tables named, no allowlist.
- `kernel-cli/config`: `config set` writes the two ignore lines.

## Impact

- New code: `kernel/src/change/`, `kernel/src/log/`, `kernel/src/measure/`, `kernel/src/query/` (slices with commands, use-cases, domain, render, schema, tests); `kernel/src/shared/store/index/` (schema, refresh, queries), `shared/store/state/derived.ts`, `shared/store/changes.ts` (paths, markers), `shared/store/ignore.ts`; `shared/git` gains `currentBranch` and `authorIdent`.
- Changed code: `shared/registry` (active Change, repeatable flags, forbidden fields, stdin), `shared/store/state/entry.ts` (`park`, `profile`), `config` slice (`set` calls `ensureIgnored`), `registrations.ts`, `main.ts`, `kernel/scripts/export-schemas.ts`.
- Contract: `schema/cli/commands.json` and `commands.schema.json` (`repeatable`), `schema/cli/output/` for the ten T20 commands (generated from zod from now on), `schema/state/entry.json`; the state fixture and the merge test rerun on kernel output.
- Bundle `dist/bdk.mjs` rebuilt. No new runtime dependency.
