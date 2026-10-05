# Tasks

## 1. Contract test for the job split

- [x] 1.1 Add `kernel/tests/contract/ci-workflow.test.ts`: parse `.github/workflows/tests.yml` with `yaml`; assert the `static` job uses `node-version-file: .nvmrc` and runs `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip` and the build determinism check; assert the `kernel` job has the matrix `["22.13", "24", "26"]`, runs `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract` and none of the static commands. Match on each step's `run` command, not its name. Verify `pnpm vitest run --project contract kernel/tests/contract/ci-workflow.test.ts` fails on the current workflow (no `static` job)

## 2. Workflow split

- [x] 2.1 In `.github/workflows/tests.yml` add the `static` job (checkout, pnpm setup, setup-node with `node-version-file: .nvmrc` and pnpm cache, frozen install, build, build is deterministic, lint, format check, typecheck, unused code and dependencies) and remove those steps from the `kernel` job; update the matrix comment. Verify the test from 1.1 passes
- [x] 2.2 Run `actionlint` on the workflow (as the `lint-repo` job does) and `pnpm format:check`; verify both are clean

## 3. Acceptance

- [x] 3.1 Run `pnpm lint && pnpm typecheck && pnpm knip` and `pnpm test:contract` locally; verify all pass
- [ ] 3.2 Push the branch and open the PR into `staging/v3`; verify on the CI run that lint, format check, typecheck, knip and the determinism check appear once in `static`, unit, E2E and contract run on Node 22.13, 24 and 26, and the run is green
- [ ] 3.3 Check whether branch protection of `staging/v3` and `main` lists required checks by name (`gh api repos/broneq/bdk/branches/<branch>/protection`); if it does, name the `static` check to add in the PR description
- [ ] 3.4 Run `openspec validate v3-t53-ci-static-job --strict` and verify it passes
