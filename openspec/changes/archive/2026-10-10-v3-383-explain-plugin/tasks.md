# Tasks

## 1. Plugin skeleton and wiring

- [x] 1.1 Turn `tests/craft-skills.test.ts` into `tests/admitted-skills.test.ts` over `bdk-craft` and `bdk-explain` (design D8); add the `bdk-explain` grants to `tests/eval-suites.test.ts`; run `pnpm test` and see the `bdk-explain` checks fail
- [x] 1.2 Create `plugins/bdk-explain/.claude-plugin/plugin.json`, `README.md`, `LICENSE`; wire `release-please-config.json`, `.release-please-manifest.json`, `.claude-plugin/marketplace.json` (design D9); verify with `claude plugin validate --strict` on the plugin and the marketplace

## 2. Eval cases (before the skill text)

- [x] 2.1 Write `explain-checkout-flow`, `explain-token-bucket`, `explain-retry-backoff` with scaffold scripts and graders (design D7); verify they load with the free check in `tests/eval-suites.test.ts`
- [x] 2.2 Trial each case once without the plugin (`--ablation none` on a copy without the skill or a plain run) to check graders and scaffolds; fix grader defects

## 3. Skill, written with /skill-creator

- [x] 3.1 Write `skills/explain/SKILL.md` with `/skill-creator` (design D1-D6); check it with `bdk-skill-kit` skill-check guidance and `claude plugin validate plugins/bdk-explain --strict`
- [x] 3.2 Try it in a separate test project with `claude --plugin-dir plugins/bdk-explain`: a "how does X work" request writes `.bdk/tmp/explain/<name>.html`, opens it, and `git status` stays clean

## 4. Measurement and admission

- [x] 4.1 Run the suite with and without the plugin (3 runs per arm, `claude-opus-5-5`, judge `claude-sonnet-5-5`, clean `HOME`); check every run for errors and re-run affected cases
- [x] 4.2 Apply the admission rule; write `plugins/bdk-explain/evals/RESULTS.md` and the README numbers; fill "Outcome" in design.md; `pnpm test` passes

## 5. Docs

- [x] 5.1 New Guide page `docs/guide/explain.md` (what it does, where pages go, the `.bdk/tmp/` convention, cleanup, remote sessions); add it to `USER_SECTIONS` in `docs/.vitepress/sidebar.ts`
- [x] 5.2 Name the plugin in `docs/guide/index.md` (plugin table), `docs/guide/install.md` (plugin list), `docs/reference/index.md`; add `.bdk/tmp/` to the table of `docs/guide/footprint.md`; add `bdk-explain` to the Reference pages of the sidebar; run `pnpm docs:reference`
- [x] 5.3 Update "Current state" in `CLAUDE.md`

## 6. Gates

- [x] 6.1 Run every CI check (`pnpm check`, `claude plugin validate --strict` on the marketplace and every plugin, docs build and diagram fit, commitlint on the commit), `openspec validate v3-383-explain-plugin --strict` and `openspec validate --specs --strict`; fix every failure
