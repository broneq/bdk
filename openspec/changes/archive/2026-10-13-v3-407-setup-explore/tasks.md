# Tasks

## 1. Eval cases

- [x] 1.1 Add the shared fixtures `plugins/bdk/evals/fixtures/node-e2e-wrapper.sh` (Next.js + Playwright: `scripts/run-e2e.sh` budget wrapper passing `"$@"`, `globalSetup` starting `next dev --port 3100` with a local backend mode and no `webServer`, a hook blocking a direct `playwright test`, `CLAUDE.md` rule for `test:heavy`, a `build` that deploys, a `chromatic` script, an ESLint-ignored folder) and `fixtures/java-cypress.sh` (Maven Spring Boot with a static UI, Cypress under `e2e/` run by `scripts/e2e.sh` with the `e2e` profile on port 8081, a default profile needing PostgreSQL, a Gatling load test); verify: each scaffold runs in a temporary directory and its wrapper scripts parse (`bash -n`)
- [x] 1.2 Add the cases `setup-node-wrapper`, `setup-java-cypress` and `explore-project-map` with their graders; verify: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` passes

## 2. Skills

- [x] 2.1 Write `plugins/bdk/skills/explore-project/SKILL.md` with `/skill-creator`: stack-agnostic brief, the map sections, main-thread start of `bdk:explorer`; update the description of `plugins/bdk/agents/explorer.md`; verify: `/bdk-skill-kit:skill-check` passes and `pnpm test` (agent-models, run-mode) passes
- [x] 2.2 Rewrite `plugins/bdk/skills/setup/SKILL.md` with `/skill-creator`: `model: opus`, the explore step before detection, the map used by detection and report, the left-out tool lines, untracked `.bdk/` content in the ignore step, `git ls-files` grant; verify: `/bdk-skill-kit:skill-check` passes
- [x] 2.3 Add "Wrapper scripts" (with `timeout`) to `references/stacks.md` and "Suite owns the server" to `references/e2e.md`; verify: `/bdk-skill-kit:skill-check` passes
- [x] 2.4 Try `/bdk:setup` in a separate test project started with `claude --plugin-dir` (the `node-e2e-wrapper` scaffold)

## 3. Measurement

- [x] 3.1 Probe `setup-node-wrapper`, `setup-java-cypress` and `explore-project-map` once each (`--ablation none --runs 1`), fix what they show, then run the two setup cases 3 times; record score, cost and time in design "Measurement"
- [x] 3.2 Run the nine existing `setup-*` cases once (`--ablation none`) as a regression; record it

## 4. Docs

- [x] 4.1 Update `docs/guide/first-run.md` (what setup does: the map, wrappers, left-out tools, the ignore entries), `docs/concepts/orchestrators.md` (redraw the `/bdk:setup` diagram with the explore step), `docs/concepts/agents.md` (the explorer's two blocks: diagram and table), `docs/concepts/e2e.md` (a suite that owns its server), `docs/guide/footprint.md` (the run file of setup); describe the new cases in `plugins/bdk/evals/README.md`
- [x] 4.2 Run `pnpm docs:reference`; verify the Reference lists `/bdk:explore-project`

## 5. Checks

- [x] 5.1 Acceptance: `setup-node-wrapper` and `setup-java-cypress` pass with the wrapper items, the matching E2E `start` and a report line per left-out tool (task 3.1 result)
- [x] 5.2 Run `pnpm check`, every other job of `.github/workflows/pr.yml`, `openspec validate v3-407-setup-explore --strict` and `openspec validate --specs --strict`
