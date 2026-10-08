# Tasks

## 1. Configuration key

- [x] 1.1 Failing tests: `DEFAULTS` holds `execution.max-parallel: 10`; a layer value 0 is a problem naming `execution.max-parallel`; `bdk config show` prints it with origin `default`
- [x] 1.2 Add `max-parallel` to the `execution` object of `plugins/bdk/src/config/domain/settings.ts`; tests green

## 2. Eval fixture and cases

- [x] 2.1 Shared fixture `plugins/bdk/evals/fixtures/ledger-totals-planned.sh`: configured tiny-ledger, Change `add-totals` (proposal, spec delta, design), plan parts 01 and 02 (`worktree`, wave 1, both listing `src/ledger.js`), `plan/verify-1.md` PASS, local git identity
- [x] 2.2 Case `resolve-conflict-two-functions` (block) with its scaffold (both part branches committed, part 01 merged, the merge of part 02 stopped on the conflict) and graders
- [x] 2.3 Cases `execute-wave-conflict` and `execute-plan-defect` (orchestrator) with their scaffolds and graders
- [x] 2.4 Free check green: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`

## 3. Blocks: `--workdir`, retry after conform, `resolve-conflict` (with /skill-creator)

- [x] 3.1 `implement-part` and `conform-part`: `--workdir` (absolute paths under it, `cd <workdir> &&` for each command); `implement-part` reads a failed conform report on a retry
- [x] 3.2 New block `skills/resolve-conflict/SKILL.md`; `agents/implementer.md` names both skills
- [x] 3.3 Try `resolve-conflict` in a scratch project built from its case scaffold with `claude -p --plugin-dir plugins/bdk`

## 4. Lead and orchestrator (with /skill-creator)

- [x] 4.1 Agent `agents/lead.md` (`bdk:lead`)
- [x] 4.2 Lead skill `skills/execute-waves/SKILL.md`
- [x] 4.3 Thin orchestrator `skills/execute/SKILL.md`
- [x] 4.4 Try `/bdk:execute` in scratch projects built from both orchestrator scaffolds with `claude -p --plugin-dir plugins/bdk`; fix what the runs show

## 5. Documentation

- [x] 5.1 `plugins/bdk/evals/README.md`: the execute cases, grants and run commands
- [x] 5.2 `CLAUDE.md` "Current state"; architecture "What We Did NOT Decide": the `claude -p` background lead probe answered

## 6. Acceptance and gates

- [x] 6.1 Run the three eval cases with `claude plugin eval` (block case both arms); record the results in design.md "Measurements"
- [x] 6.2 Every check CI runs (`pnpm check` and the other jobs of `.github/workflows/pr.yml`), `openspec validate v3-200-bdk-execute-lead --strict`, `openspec validate --specs --strict`
