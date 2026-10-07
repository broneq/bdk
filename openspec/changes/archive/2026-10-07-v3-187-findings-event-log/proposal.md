# Proposal

## Why

Tracks #187.

A review round runs several writers at once - one reviewer per file group, the integration reviewer, E2E checks, `bdk check run`, then the judge and triage - and all of them record into one `review/round-N/findings.jsonl` (design `2026-10-07-v3-architecture.md`, "Findings and triage"). If each writer rewrote a shared file, parallel writers would lose each other's work. The file is therefore an event log: writers only append one line per call, and one command folds the log into the current view. Draft 1 held findings in a kernel ledger (`bdk log add|list|triage`); this replaces it with a file and a stateless fold, in line with ADR-0003 (the CLI computes or saves a model turn, it never governs).

## What Changes

- New command group `bdk findings`, the first product slice of the `bdk` CLI (`plugins/bdk/src/findings/`):
  - `bdk findings add <log>` appends a `finding` event and prints the finding id, which the CLI derives from the dedupe key.
  - `bdk findings level <log> <id> <level>` appends a `level` event (judge: `blocker`, `should-fix`, `nice-to-have`, `not-a-problem`).
  - `bdk findings decide <log> <id> <decision>` appends a `decision` event (triage: `fix`, `accept`, `defer` with an issue).
  - `bdk findings list <log>` folds the log: dedupes findings, applies the latest level and decision per finding, counts by level and decision, and lists the findings, filtered by `--level` and `--decision` (for example `--decision fix`: what to fix).
- The event line schema and the dedupe key ("To resolve in the spec" of #187) are specified in `bdk-cli/findings`.
- A `shared/fs` OS boundary module (file reads and appends, injected into the slice by `main.ts`), with the API agreed with #179, and `zod` as the schema library of `--json` results (design D7 of `v3-178-bdk-plugin-skeleton`).

Out of scope: `bdk check run` appending red checks itself (the `check` slice, its own issue), the triage page, the judge and the reviewer blocks (skills of later issues), and `bdk run status` reading the log (#188).

## Capabilities

### New Capabilities

- `bdk-cli/findings`: the findings event log of a review round - the event line schema, the dedupe key, the append-only write commands and the fold that lists findings with their latest level and decision.

### Modified Capabilities

None. The frame rules of `bdk-cli` (output, errors, exit codes, slices, OS boundary) apply unchanged.

## Impact

- `plugins/bdk/src/findings/` (new slice), `plugins/bdk/src/shared/fs/` (new OS boundary module), `src/slices.ts` and `src/main.ts` (one entry each).
- `plugins/bdk/package.json` and `pnpm-lock.yaml`: `zod` as a runtime dependency, bundled into `dist/bdk.mjs`.
- Callers: the reviewer, judge and triage blocks and `bdk run status` (#188) read and write the log through this group; `src/findings/index.ts` exports the add and list use cases for slices that need them.
