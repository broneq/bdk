# Proposal

## Why

Scope: #131. Tracks #131.

The `kernel` job of `.github/workflows/tests.yml` runs every step on each line of the Node matrix (22.13, 24, 26), as the `kernel-architecture` requirement "Continuous integration" demands. Lint, format check, typecheck, the unused code check and the build determinism check do not depend on the Node runtime: their tools and `@types/node` are pinned by the lockfile and esbuild output is the same on every line. They run three times for no added coverage, about 90 s of runner time per CI run (run 37342211401). Only the steps that execute kernel code (unit, E2E, contract) gain anything from the matrix. E2E alone takes 222-316 s of a 6-8 min matrix job and sets the wall clock of every CI run.

## What Changes

- A new `static` job in `tests.yml` on the Node line of `.nvmrc`: frozen install, build, build determinism check, lint, format check, typecheck, unused code and dependency check.
- The `kernel` matrix job keeps frozen install, build, unit tests with coverage, the OpenSpec install and contract tests.
- E2E tests move to an `e2e` job whose matrix is the Node line times two shards (`vitest --shard`), so each line runs every E2E file once, split over two runners.
- The three jobs run in parallel.
- The `kernel-architecture` requirement "Continuous integration" describes the two jobs, names the build determinism check (present in the workflow since T48, absent from the spec) and updates the acceptance run scenario.
- A contract test reads `tests.yml` and holds the split: the Node-independent checks run only in `static`, the runtime suites run on every matrix line.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-architecture`: requirement "Continuous integration" - the kernel steps split into a `static` job on `.nvmrc`, a `kernel` job and a sharded `e2e` job on the Node matrix; the build determinism check becomes part of the requirement.

## Impact

- `.github/workflows/tests.yml` (the `kernel` job, new `static` and `e2e` jobs).
- `vitest.config.ts`: automatic git maintenance off in every test project. `git commit` starts a detached `git maintenance run --auto`, which on the runner's git 2.55 wrote under `.git/objects/pack` while a unit test removed its repository (ENOTEMPTY on the first CI run of this branch).
- `kernel/tests/contract/` (one new test file).
- `openspec/specs/kernel-architecture/spec.md` through the delta.
- Branch protection: if `main` or `staging/v3` requires the status checks by name (`kernel (22.13)` and so on), the new `static` check has to be added to the required list by hand after the merge.
- Requirement "Tests per slice" stays unchanged: it asks for the test suite on the Node matrix, which still holds.
- Out of scope: merging the small jobs (`skill-check`, `eval-config`, `audit`, `lint-repo`), the `ubuntu-latest` image migration.
