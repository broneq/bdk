# Proposal

## Why

Scope: #160. Tracks #160.

The diff check (`kernel-loops`, Diff check) gives the Change target of a `review-fix` ticket the `do-not-touch` globs of every started part, done parts included. A part's `do-not-touch` is written to keep the tasks of that one part away from other parts' files, so with several parts almost every file of the Change sits under some part's list: a real Change with 7 done parts had its review fix in `harness/` refused at `bdk commit <change-id>` with `policy/do-not-touch`, citing part 01, whose `instead` is to discard the fix. Editing the plan parts to get the commit through made `plan-verify` stale and moved `bdk next` back to the plan stage, so the review round had no way forward.

## What Changes

- The Change target of the diff check forbids no glob: a review fix may change any path, as it already declares every path it touches (T42). `attempt close` and `commit <change-id>` of a `review-fix` ticket no longer refuse with `policy/do-not-touch`.
- Task and part targets keep their part's `do-not-touch` unchanged, and a review fix still leaves another started part's uncommitted work in flight to that part.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-loops`: Diff check - the Change target has no forbidden globs; new scenario `review fix touches a do-not-touch path`.

## Impact

`kernel/src/part/use-cases/diff.ts`, its unit tests `kernel/src/part/tests/diff.test.ts` and `kernel/src/commit/tests/commit.test.ts`, the E2E test `kernel/src/commit/tests/commit.e2e.ts`, `openspec/specs/kernel-loops/spec.md`. `.prettierignore` leaves out the local `.venv/` and `.pytest_cache/`, which `pnpm format:check` read. No CLI surface, schema, refusal rule or setting changes: `policy/do-not-touch` stays for task and part targets.
