---
status: accepted
date: 2026-09-25
decision-makers: {TBD}
consulted: {TBD}
informed: {TBD}
---

# ADR-0005: Markdown files are the truth of a Change, with a rebuildable SQLite index behind one store module

## Context and Problem Statement

A v3 Change is a durable object on disk: an append-only ledger with one file per entry (K4), attempt records, evidence manifests, dispatch packages and reports. The kernel reads this state on every call, and some reads are queries over many entries: `log list --for`, oscillation detection, finding reports across Changes. A Change holds hundreds of entries and a project thousands, and `log list` must stay under 200 ms at 1 000 entries. The user asked whether Dolt, a SQL database with git semantics per row, should hold the state instead of Markdown files. The question is where the truth of a Change lives and how it is queried. Register entry: R-store (`docs/v3/2026-09-23-0703-bdk-v3-decisions.md`, step 2A.3).

## Decision Drivers

- **Knowledge is committed and readable in the PR** (D2b). Decisions, findings and learnings are reviewed in the same diff as the code and are searchable with grep.
- **One version axis.** Git commits with BDK trailers are the truth for progress; a second versioned store would need to be pinned to git SHAs.
- **Only Node on the user's machine** (D5, ADR-0002). No second runtime and no database server.
- **Ad hoc queries for debugging and reports** without writing code for each question.
- **Latency.** `log list` under 200 ms at 1 000 entries, on top of a 30-50 ms kernel start.
- **Scale that exists, not scale that might.** Hundreds of entries per Change, thousands per project.

## Considered Options

1. **Markdown truth plus a rebuildable SQLite index** - every entry is a Markdown file with frontmatter in the Change directory; a SQLite index in the gitignored `.bdk/.machine/` is built from those files through `node:sqlite` and rebuilt lazily; `bdk query "<sql>"` is read-only; one `store` module is the only access point and can be swapped.
2. **Dolt as the state store** - the ledger, Change state and attempts live in Dolt, with SQL over the whole state and commit, branch, merge, diff and blame per row.
3. **Markdown files without SQL** - the same files, read and filtered in code on every call.

## Decision Outcome

**Chosen option: 1, Markdown truth plus a rebuildable SQLite index**, because it keeps knowledge in the PR and in git's single version axis, needs nothing beyond Node, and gives about 90 % of Dolt's benefit: SQL over the whole state through the index, history and blame through git on per-entry files, branching and merging through git because the Change directory is in the repository. Dolt is the right tool when the data is itself the product and many writers must branch and merge it independently of code; here the data is the trace of work on code and lives next to it.

### Consequences

- ✅ Every entry is a reviewable file; a changed decision is a new entry with `supersedes`, so `git log` and `git blame` are the history.
- ✅ The index is a cache: deleting it loses nothing, and the next call rebuilds it from the files.
- ✅ `bdk query` answers ad hoc questions read-only; the same tables feed `log list --for` and oscillation detection.
- ✅ `node:sqlite` ships with Node from 22.13.0 unflagged, so the index adds no dependency and no native module (ADR-0002).
- ✅ The `store` module isolates the storage: if parallel writers on one Change ever need a real database, replacing the store does not touch skills or the CLI contract.
- ❌ The index must be kept fresh: it is rebuilt lazily when the `stat` of the `log/` and `attempts/` directories or their file count changes, with a full rehash only after a change (V1-9).
- ❌ Concurrent kernel calls share one SQLite file; a busy timeout covers contention, and a lost index write is repaired by the lazy rebuild.
- 🟡 `node:sqlite` is a release candidate (stability 1.2) since Node 25.7 and experimental before that; Node 22.13 to 22.x print an `ExperimentalWarning`, which the store suppresses for that warning only. No JSON index fallback is kept, because no supported Node lacks `node:sqlite` (T11 design D-11).

### Implementation Requirements

- [x] `shared/store` as the only module that opens files of a Change and the index; the index at `.bdk/.machine/index.sqlite` with a busy timeout and a schema version, `node:sqlite` loaded only on first open (T11).
- [ ] Index tables built from the ledger and attempts; lazy rebuild by directory freshness; a deleted index rebuilt without data loss (T20).
- [ ] `bdk query "<sql>"` read-only (T20).
- [ ] `log list` under 200 ms at 1 000 entries, with timing telemetry in `.machine/` from day one (T20).

## Pros and Cons of the Options

### Markdown truth plus a rebuildable SQLite index

- ✅ Knowledge stays in the PR and in grep; one version axis.
- ✅ SQL for debugging and reports without a server or a second runtime.
- ✅ Swappable behind the `store` module.
- ❌ A cache to keep fresh, and one more place state can be stale for a moment.

### Dolt as the state store

- ✅ SQL over the whole state: "security findings from the last five Changes that came back after a fix" is one query.
- ✅ Row-level history, diff and `dolt blame` on a decision; branch and merge of data when two people write to one Change.
- ✅ One consistent transaction instead of many files.
- ❌ A second versioning system: which Dolt state matches which git SHA must be tracked, splitting the truth in two.
- ❌ Knowledge leaves the PR: the data is in Dolt's format and must be exported for review and translated for agents through SQL (against D2b).
- ❌ A team needs a remote Dolt (DoltHub or self-hosted) or a committed binary `.dolt/` directory.
- ❌ A second runtime, a Go binary of about 100 MB installed per machine and on CI, against D5. The user noted this cost does not hurt; the second version axis and knowledge outside the PR decided.
- ❌ The scale does not need it: thousands of entries is a size SQLite searches in milliseconds.

### Markdown files without SQL

- ✅ The simplest option: no index, nothing to keep fresh.
- ❌ Ad hoc questions while debugging need new code or grep over files.
- ❌ `log list` parses every file on every call, the hot path the latency target is about.

## More Information

- Design `docs/v3/2026-09-23-0703-bdk-v3-change-centric-design.md`: "Change directory (knowledge committed, machine state local)", the `store` line in "Selected Approach", "Constraints & NFRs" (row Latency), "Risk Register" (bottleneck: ledger index; `node:sqlite` availability); Dolt analysis on design page 04 (`docs/v3/bdk-v3-design-04-doprecyzowanie.html`, section 6).
- HOST-FACTS `node-sqlite-min`, `node-sqlite-stability`, `node-sqlite-local` (`docs/HOST-FACTS.md`).
- Future extension, not decided: global finding discovery across Changes in the application, using the SQLite index and `bdk query` (the user's note on R-store; design "What We Did NOT Decide").
- Implemented by T11 (store skeleton and index file) and T20 (tables, rebuild, `query`).
