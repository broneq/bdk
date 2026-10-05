# Verification Scoping - Shared Definitions

Two definitions are repeated across the planning/execution skills, the role contracts, STARTUP_INSTRUCTIONS.md and, for the file-class partition, the kernel's `policy.evidence` defaults. No test enforces their consistency; if one copy drifts, verification is silently skipped or silently over-run. When editing any copy, keep them all saying the same thing.

## `Verification: none` task class

A plan task may declare `Verification: none` when ALL of its `Files:` are non-executable content (yaml/md/json/plain config not consumed by build or codegen), pure wiring/glue, or a refactor fully covered by existing tests. Such a task has no `Test cases:` block, never runs a test-first loop, and is verified by its `Success criterion` plus the end-of-plan review.

## File-class partition (source vs non-executable)

Verifiers partition changed files: **source** gets scoped/related tests, scoped lint, incremental typecheck; **non-executable content** gets no tests and no typecheck, at most a configured syntax/schema validator. **Build-feeding config always counts as source** (tsconfig, lockfiles, schemas used for codegen) - a change there can break compilation without touching a source file.

The kernel holds a copy of this partition as the default glob lists of `policy.evidence` (`non-executable`, `build-config`; `kernel/src/evidence/config.ts`): a non-executable change never makes evidence stale, a build-config change always does.

The full unscoped suite runs only on explicit request or at a pipeline's end-of-plan gate. Never widen a verification run "just to be safe".
