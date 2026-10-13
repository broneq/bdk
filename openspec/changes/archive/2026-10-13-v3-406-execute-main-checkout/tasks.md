## 1. Plan check without isolation

- [x] 1.1 Change the tests first: `src/plan/tests/part.test.ts` (a part with `isolation` has a `frontmatter` fault naming it and saying to remove it; a part without it has none), `src/plan/tests/check.test.ts` (no `overlap`, no `shared-not-alone`), `src/plan/tests/render.test.ts` (no isolation column), `src/plan/tests/use-cases.test.ts`, `tests/plan.test.ts`; see them fail
- [x] 1.2 `src/plan/domain/part.ts`: drop `ISOLATIONS` and `Part.isolation`; fault on the key `isolation`
- [x] 1.3 `src/plan/domain/check.ts`: drop the checks `overlap` and `shared-not-alone`, their texts and `PartSummary.isolation`; reword the `frontmatter` and `max-tasks` fixes; `src/plan/schema/check.ts` and `src/plan/render/check.ts` without isolation; tests green

## 2. Settings and the shipped schema

- [x] 2.1 `src/config/domain/settings.ts`: the description of `execution.max-parallel` (read-only agents); its tests
- [x] 2.2 `tests/openspec-schema.test.ts` first (the part template has no `isolation`), then `openspec/schemas/bdk/schema.yaml` and `templates/part.md`

## 3. Execute blocks

- [x] 3.1 Eval case `repair-wave-dated` (from `resolve-conflict-wave`, prompt and graders naming `repair-wave`) before the skill text
- [x] 3.2 New skill `skills/repair-wave/SKILL.md` with `/skill-creator`: today's "Wave repair" of `resolve-conflict` (W1 to W5) as its whole job, arguments `<change> <n> --base <commit> [--run-dir] [--parts]`
- [x] 3.3 Remove `skills/resolve-conflict/` and the eval cases `resolve-conflict-two-functions` and `resolve-conflict-wave`, and the fixture files only they use
- [x] 3.4 `implement-part` and `conform-part` without `--workdir` (argument hint, allowed tools, step 1, the check commands), with `/skill-creator`
- [x] 3.5 `agents/implementer.md` (`implement-part` or `repair-wave`), `agents/lead.md` (no merges)

## 4. Execute lead and stage

- [x] 4.1 Eval cases first: `execute-main-checkout` (acceptance: three parts in order, no `--workdir`, no `git worktree` or `git merge`, three commits, `Status: done`) from `execute-single-part-wave`; update `execute-resume-main-checkout` and `execute-wave-check` (graders naming `repair-wave`); remove `execute-single-part-wave`, `execute-resume-worktree` and `execute-wave-conflict`
- [x] 4.2 Rewrite `skills/execute-waves/SKILL.md` with `/skill-creator`: parts one at a time in plan order in the main checkout, commit after each, a blocked part stops the stage, wave check with `repair-wave`; no worktree, merge, batch or `execution.max-parallel`
- [x] 4.3 `skills/execute/SKILL.md`: description and blocker text without worktrees and merges

## 5. Plan writers

- [x] 5.1 `plan-draft` and `references/part-example.md`: no `isolation`, no disjoint-files rule in a wave; with `/skill-creator`
- [x] 5.2 `plan-fixes` and `diagnose-bug`: fix parts without `isolation`; the one-part/several-parts rule without `shared`/`worktree`
- [x] 5.3 Remove `isolation` from every part an eval case or fixture writes (`evals/fixtures/*.sh`, `household-book/change/plan/parts/`, the `parts/` of the `plan-draft-*` and `verify-plan-*` cases, graders that match it); recorded transcripts and patches stay as recorded
- [x] 5.4 `evals/README.md`: the execute, wave and repair cases, their grants (no `cd *` for the execute blocks), scores marked not re-run in this Change

## 6. Docs

- [x] 6.1 `docs/concepts/orchestrators.md`: redraw the execute-waves diagram (parts in order, commit per part, no worktree or merge), the per-part diagram, remove the merge diagram; the check table without `merge-NN`, `wave-N` repaired by `/bdk:repair-wave`; the Sources list
- [x] 6.2 `docs/concepts/run-state.md`: run directory tree (no `worktrees/`, no `merge-NN.md`, `wave-N.md` by `/bdk:repair-wave`), file table, redraw the Execute sequence (no merge-conflict frame), the troubleshooting row about worktrees
- [x] 6.3 `docs/concepts/stages.md` (how a plan is cut: no `isolation`, sequence and wave check), `docs/concepts/agents.md` (blocks table: `/bdk:repair-wave`), `docs/concepts/cli-config-hooks.md` (callers of `bdk check run`, `tools.*` and `execution.max-parallel` rows), `docs/concepts/glossary.md` (Wave)
- [x] 6.4 `docs/guide/workflow.md` (execute stage), `docs/guide/configuration.md` (Parallel work), `docs/guide/footprint.md` (`execution.max-parallel` row)
- [x] 6.5 `pnpm docs:reference`

## 7. Check

- [x] 7.1 Acceptance signal: the `execute-main-checkout` case loads (`claude plugin eval --dry-run` or the free check of the README) and its graders match the spec; a paid run only with a budget on #406
- [x] 7.2 `pnpm check`, every other job of `.github/workflows/pr.yml`, `openspec validate v3-406-execute-main-checkout --strict` and `openspec validate --specs --strict`
