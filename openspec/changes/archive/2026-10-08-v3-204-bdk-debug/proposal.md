## Why

Tracks #204.

BDK v3 has the whole Change pipeline (propose, design, plan, execute, auto-review, close) but no way to fix a reported bug. v2's `debug` (tag `v2.7.0`) investigated in the main thread, wrote a failing test and fixed inline after a hard stop, with no product-level reproduction and no review of the fix. The architecture (`docs/design/2026-10-07-v3-architecture.md`, "Catalog") lists `/bdk:debug` as a main-thread orchestrator composing "E2E reproduction, failing test, fix, `auto-review` of the fix scope", writing "fix with its test"; the v3 correctness goal (CLAUDE.md, "Goal of this line") asks that a fix is proven on the product, not only in code.

## What Changes

- New block `diagnose-bug` (`plugins/bdk/skills/diagnose-bug/`, main thread): takes a bug report (text or GitHub issue), reproduces the bug as a user would (through a `tools.e2e` item, or the closest public interface when the project has none), finds the root cause in the code, and writes a fix Change in the BDK schema: `proposal.md`, a spec delta whose scenario states the expected behaviour of the reproduction, `design.md` with the reproduction and the root cause, and one plan part `plan/parts/01.md` whose acceptance scenario is that scenario. It records `.bdk/runs/<change>/debug/diagnosis.md` with `Status: ready`, `not-reproduced` or `too-large` (the fix does not fit one part: no plan part is written). It never edits code or tests.
- New orchestrator `/bdk:debug` (`plugins/bdk/skills/debug/`, main thread): composes `diagnose-bug`, the design gate (`policy.gates.design`), `commit` of the fix Change on the Change's branch, `/bdk:execute` (the implementer writes the failing test first, sees it red, fixes, sees it green; the conformer checks the part; the lead commits) and `/bdk:auto-review` of the fix Change, then writes `.bdk/runs/<change>/debug/result.md`. It resumes from these files and names `/bdk:close <change>` as the next step.
- Eval: block cases `diagnose-bug-reproduced` and `diagnose-bug-not-reproduced`, orchestrator cases `debug-fix` (the acceptance signal: a reproduced bug fixed with a test, reviewed) and `debug-manual-gate`, on a new shared fixture with a seeded bug.

## Capabilities

### New Capabilities
- `bdk-debug`: the `/bdk:debug` orchestrator and the `diagnose-bug` block - reproduction, root cause, the fix Change, the gate, the fix through execute, the review of the fix Change, the result and resume.

### Modified Capabilities
None.

## Out of scope

- `/bdk:run` (#203): the autopilot does not queue bug fixes in this Change.
- Opening the pull request: `/bdk:close` (#202) closes the fix Change as any other.
- Transcript diagnostics of BDK runs (`bdk diag`, architecture "What We Did NOT Decide"); draft 1's `diagnose` skill was that tool, not a bug fixer.
- The `debugging` craft skill of `bdk-craft` (#207).

## Impact

- New: `plugins/bdk/skills/debug/`, `plugins/bdk/skills/diagnose-bug/`.
- `plugins/bdk/evals/`: four cases, one shared fixture, README grants and run commands.
- `CLAUDE.md` "Current state".
- No CLI change and no change to existing skills: `bdk plan check` checks the fix part, `/bdk:execute`, `/bdk:auto-review` and `commit` run the fix Change as they run any Change.
