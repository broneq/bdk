# Tasks

## 1. Contract test for the job split

- [x] 1.1 Add `kernel/tests/contract/ci-workflow.test.ts`: parse `.github/workflows/tests.yml` with `yaml`; assert the `static` job uses `node-version-file: .nvmrc` and runs `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip` and the build determinism check; assert the `kernel` job has the matrix `["22.13", "24", "26"]`, runs `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract` and none of the static commands. Match on each step's `run` command, not its name. Verify `pnpm vitest run --project contract kernel/tests/contract/ci-workflow.test.ts` fails on the current workflow (no `static` job)

## 2. Workflow split

- [x] 2.1 In `.github/workflows/tests.yml` add the `static` job (checkout, pnpm setup, setup-node with `node-version-file: .nvmrc` and pnpm cache, frozen install, build, build is deterministic, lint, format check, typecheck, unused code and dependencies) and remove those steps from the `kernel` job; update the matrix comment. Verify the test from 1.1 passes
- [x] 2.2 Run `actionlint` on the workflow (as the `lint-repo` job does) and `pnpm format:check`; verify both are clean

## 3. E2E in its own sharded job

- [x] 3.1 Extend `ci-workflow.test.ts`: an `e2e` job with matrix `node: ["22.13", "24", "26"]` and `shard: [1, 2]` that runs `pnpm test:e2e --shard=${{ matrix.shard }}/2`; the `kernel` job runs `pnpm test:unit` and `pnpm test:contract` and no `pnpm test:e2e`. Verify the test fails on the current workflow
- [x] 3.2 Move the E2E step out of `kernel` into the new `e2e` job in `tests.yml`; verify the test from 3.1 passes, `actionlint` is clean, and `pnpm test:e2e --shard=1/2` plus `--shard=2/2` locally run 39 files in total

## 4. Flaky test found by the first CI run

- [x] 4.1 Add `kernel/tests/support/git-maintenance.test.ts` (git in a test sees `maintenance.auto=false` and `gc.auto=0`); verify it fails without the fix
- [x] 4.2 Set the `GIT_CONFIG_*` env in every project of `vitest.config.ts`; verify the test from 4.1 and `pnpm test:unit` pass

## 5. Acceptance

- [x] 5.1 Run `pnpm lint && pnpm typecheck && pnpm knip` and `pnpm test:contract` locally; verify all pass
- [x] 5.2 Push the branch and open the PR into `staging/v3`; verify on the CI run that lint, format check, typecheck, knip and the determinism check appear once in `static`, unit and contract run on Node 22.13, 24 and 26, E2E runs in two shards on each of those lines, and the run is green
- [x] 5.3 Check whether branch protection of `staging/v3` and `main` lists required checks by name (`gh api repos/broneq/bdk/branches/<branch>/protection`); if it does, name the `static` check to add in the PR description
- [x] 5.4 Run `openspec validate v3-t53-ci-static-job --strict` and verify it passes
