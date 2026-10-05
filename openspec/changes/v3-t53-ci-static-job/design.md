# Design

## Context

See proposal.md - Why. The `kernel` job steps today, with their time on one matrix line in run 37342211401: install 2 s, build 1 s, build determinism 1 s, lint 22 s, format check 11 s, typecheck 7 s, knip 2 s, unit 51 s, E2E 223 s, OpenSpec install 3 s, contract 11 s. E2E dominates the wall clock (223-316 s per line). The release workflow builds on `.nvmrc`. About half of the contract test files spawn `dist/bdk.mjs`, and `state-merge` depends on `node:sqlite`.

## Goals / Non-Goals

**Goals:**

- Every Node-independent check runs once per CI run.
- Every step that executes kernel code still runs on every matrix line.
- The split is held by a test, so a step added to the wrong job fails CI.

**Non-Goals:**

- A shorter wall clock. It is bounded by E2E; sharding E2E is separate work.
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

### D4. The split is tested by reading the workflow file

A contract test parses `tests.yml` with the `yaml` package (already a dependency) and asserts by the `run` command of each step, not by step names: the `static` job uses `node-version-file: .nvmrc` and runs `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip` and the determinism check; the `kernel` job has the three-line matrix, runs `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, and none of the static commands.

Alternative: rely on review only. Rejected because the duplicated steps were exactly what review let through, and the spec scenario is cheap to check mechanically.

## Risks / Trade-offs

- [Required status checks are configured by job name] -> after the merge, add `static` to the required checks of `staging/v3` and `main` if the branch protection lists checks by name; the PR description names this step.
- [A future check that does depend on the runtime lands in `static` by habit] -> the requirement text states the criterion (does the step execute kernel code), and the contract test makes the job list explicit.
