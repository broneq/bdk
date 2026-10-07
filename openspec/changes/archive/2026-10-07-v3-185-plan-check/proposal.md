# Proposal

## Why

Tracks #185.

`/bdk:plan` runs `bdk plan check` on the parts `plan-draft` wrote (`docs/design/2026-10-07-v3-architecture.md`, "Flows" - "Plan"). The recorded measurement: B1's parts formed 6 waves and execute took 47 minutes, so wave depth decides the duration ("Stages and units of work"). Parallel parts that share a file cause merge conflicts, and a `shared` part must run alone in its wave ("Execute", "Risks"). Counting tasks, bytes and files, finding cycles and layering waves by hand costs model turns and goes wrong; ADR-0003 principle 6 admits a CLI helper for such a computation.

## What Changes

- New command group `plan` in the `bdk` CLI with one verb: `bdk plan check <dir>`, where `<dir>` is a Change's `plan/parts/` directory in the part format of `bdk-openspec-schema` (#180).
- It reads every part file `NN.md`, checks its frontmatter, counts its tasks, distinct files and bytes against `plan.part.max-tasks`, `plan.part.max-files` and `plan.part.max-bytes` (defaults 5, 10, 8192, from the resolved configuration of #179), finds unknown `depends-on` ids and `depends-on` cycles, layers the parts into waves, and reports files listed by two parts of one wave and a `shared` part that is not alone in its wave.
- Every problem names its check and the part ids it concerns; the waves are printed in order. Exit 0 when the plan has no problem, exit 1 with the same result when it has one.
- The output format is fixed for `plan-draft` and `/bdk:plan` (the issue's "To resolve in the spec"): a text form for a model reading a Bash result and a `--json` form with a zod schema.

### Resolved from "To resolve in the spec"

- **Output format read by `plan-draft`:** resolved in the `bdk-cli/plan` spec ("Check output") and design D6: a summary line, the waves in order, one line per part with its counts against the limits, and one line per problem led by its check and part ids; `--json` holds the same as `limits`, `parts`, `waves` and `problems`.

### Out of scope

- Writing parts and splitting oversized parts: `plan-draft` and `/bdk:plan` (#199 and the plan blocks).
- The part format itself: `bdk-openspec-schema` (#180), unchanged.
- The settings keys `plan.part.*` and their defaults: `bdk config` (#179), unchanged.
- Running waves, worktrees and merges: `/bdk:execute` (#200).
- Grouping changed files by part for review: `bdk git groups --plan` (#186), unchanged.
- Part progress: `bdk run status` (#188), unchanged.

## Capabilities

### New Capabilities

- `bdk-cli/plan`: the `bdk plan check` command - the part files it reads, the limits it applies, the dependency, wave, overlap and `shared` checks, and its text and JSON output.

### Modified Capabilities

None. The frame and architecture requirements of `bdk-cli`, the part format of `bdk-openspec-schema` and the settings of `bdk-cli/config` apply unchanged.

## Impact

- `plugins/bdk/src/plan/` (new slice), its row in `src/slices.ts` (importing `config` for `loadConfig`), its entry in `src/main.ts`; `plugins/bdk/tests/plan.test.ts` (end to end through the frame and the real file system).
- Reads the part directory and the configuration layers; writes nothing; no new dependency (`yaml` and `zod` are already runtime dependencies).
- Shared ground touched: `src/slices.ts` and `src/main.ts` (one row and one entry each).
