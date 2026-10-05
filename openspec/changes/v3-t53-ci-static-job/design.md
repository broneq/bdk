# Design

## Context

See proposal.md - Why. The `kernel` job steps today, with their time on one matrix line in run 37342211401: install 2 s, build 1 s, build determinism 1 s, lint 22 s, format check 11 s, typecheck 7 s, knip 2 s, unit 51 s, E2E 223 s, OpenSpec install 3 s, contract 11 s. E2E dominates the wall clock (223-316 s per line). The release workflow builds on `.nvmrc`. About half of the contract test files spawn `dist/bdk.mjs`, and `state-merge` depends on `node:sqlite`.

## Goals / Non-Goals

**Goals:**

- Every Node-independent check runs once per CI run.
- Every step that executes kernel code still runs on every matrix line.
- The critical path of a CI run drops from one matrix job running unit, E2E and contract in sequence (6-8 min) to the longest of the parallel jobs.
- The split is held by a test, so a step added to the wrong job fails CI.

**Non-Goals:**

- Changes to the other jobs and workflows.

## Decisions

### D1. The `static` job builds and runs the build determinism check

`pnpm install` already builds through `prepare`; the explicit build step and the determinism check (build twice, compare checksums of `dist/`, `schema/`, `agents/`) stay together in `static`, which keeps the job equal to the current step order minus the runtime suites. The release job builds on `.nvmrc`, and `static` runs on the same line, so the check covers the build the release publishes.

Alternatives: keep the determinism check in the matrix (esbuild output does not depend on the Node line, so two of three runs are duplicates); move it into the release workflow (a non-deterministic build would only surface at release time, after the merge).

### D2. `static` and the matrix run in parallel

No `needs` between them. A failing lint shows up within about a minute either way, and the matrix does not wait about 70 s for `static` on every green run.

Alternative: `kernel` `needs: static` saves matrix runner time when a static check fails, at the cost of a longer wall clock on every passing run, which is the common case.

### D3. Contract tests stay in the matrix as one project

They run 11-16 s per line. Half of them execute the bundle and depend on the runtime (`node:sqlite`, child process behaviour). Splitting the `contract` project into static and runtime halves saves about 10 s per line and adds a vitest project and a classification rule for every new contract file.

### D4. E2E runs in its own job, in two shards per Node line

The `e2e` job has the matrix `node: ["22.13", "24", "26"]` times `shard: [1, 2]` and runs `pnpm test:e2e --shard=<shard>/2`. The 39 E2E files take 646 s of file time; vitest spreads them over the runner's cores, which gave 222 s of wall clock on Node 22.13. Two shards bring each half to about 110-160 s plus about 30 s of setup. The `kernel` job keeps unit and contract, about 60-80 s of tests.

Alternatives: a separate E2E job without shards (takes only the unit and contract time, about 70 s, off the critical path); three shards (about 2-2.5 min instead of 2.5-3.5, but 9 E2E jobs, 3 kernel jobs and the other 5 jobs come close to the free plan's limit of 20 concurrent jobs, so a second PR would queue); balancing shards by recorded duration (vitest splits by file and the largest files take 43-53 s each, so an uneven split costs at most about one large file).

### D5. The split is tested by reading the workflow file

A contract test parses `tests.yml` with the `yaml` package (already a dependency) and asserts by the `run` command of each step, not by step names: the `static` job uses `node-version-file: .nvmrc` and runs `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip` and the determinism check; the `kernel` job has the three-line matrix and runs `pnpm test:unit` and `pnpm test:contract`; the `e2e` job has the same Node lines and two shards and runs `pnpm test:e2e --shard=${{ matrix.shard }}/2`; neither runs a static command.

Alternative: rely on review only. Rejected because the duplicated steps were exactly what review let through, and the spec scenario is cheap to check mechanically.

## Risks / Trade-offs

- [Required status checks are configured by job name] -> after the merge, add `static` to the required checks of `staging/v3` and `main` if the branch protection lists checks by name; the PR description names this step.
- [Shards drift apart as E2E files grow] -> the job durations show it on every run; a third shard fixes it without a spec change, since the spec does not fix the shard count.
- [A future check that does depend on the runtime lands in `static` by habit] -> the requirement text states the criterion (does the step execute kernel code), and the contract test makes the job list explicit.
