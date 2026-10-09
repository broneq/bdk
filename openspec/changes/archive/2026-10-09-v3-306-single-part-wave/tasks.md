# Tasks

## 1. Eval cases first

- [x] 1.1 Shared fixture `plugins/bdk/evals/fixtures/ledger-totals-three-parts.sh`: `ledger-totals-planned.sh` plus part `03` (`summary(entries)`, `depends-on: ["01", "02"]`, `isolation: worktree`) and its spec scenario; `bdk plan check` on it prints waves `1: 01 02` and `2: 03`
- [x] 1.2 `execute-single-part-wave` (orchestrator): graders - implementer prompts for `01` and `02` with `--workdir`, none for `03` with `--workdir`; reflog of `add-totals` holds a commit naming part 03 and no merge of `bdk/add-totals/part-03`; `state.json` all done; result `Status: done`; `plan/parts/03.md` still `isolation: worktree`
- [x] 1.3 `execute-resume-worktree` (orchestrator): scaffold merges `01` and `02` on `add-totals`, writes `state.json`, and leaves `.bdk/runs/add-totals/worktrees/03` on `bdk/add-totals/part-03` with part 03's test uncommitted; graders - implementer for `03` with `--workdir`, merge of `bdk/add-totals/part-03` in the reflog, `03` done
- [x] 1.4 `execute-resume-main-checkout` (orchestrator): same start, but part 03's test uncommitted in the main checkout and `03` blocked with 1 attempt; graders - no `--workdir` for `03`, no stop on uncommitted changes, commit of part 03 on `add-totals`, result `Status: done`
- [x] 1.5 The free check passes on the new cases: `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`

## 2. Skill (built with /skill-creator)

- [x] 2.1 `skills/execute-waves/SKILL.md`: step 3 accepts the leftover work of the part that runs next in the main checkout (D3); step 4 runs a lone part of a wave in the main checkout unless its worktree or branch exists (D1, D2); steps 5 and 6 speak of parts run in the main checkout and in a worktree; the description no longer says every worktree part gets a worktree
- [x] 2.2 `skills/execute/SKILL.md` and `agents/lead.md`: wording checked against the new rule (no change needed)
- [x] 2.3 `skill-check` on the changed skill: no new finding (its two `model-names` errors and one `description-front-loaded` warning were there before; `plugins/bdk` has no skill-check config in CI)

## 3. Try the skill

- [x] 3.1 Try the skill on the three new cases and record the results in this Change (`design.md`, "Trial"); fix the skill text until they pass
- [x] 3.2 `evals/README.md`: the new fixture and cases

## 4. Docs

- [x] 4.1 `docs/concepts/orchestrators.md`: execute-waves diagram, "a work directory per part"
- [x] 4.2 `docs/concepts/stages.md` (`isolation` in "How a plan is cut"), `docs/concepts/run-state.md` (`worktrees/NN/`), `docs/guide/workflow.md` (execute paragraph)
- [x] 4.3 `pnpm docs:reference`

## 5. Gates

- [x] 5.1 Acceptance signal checked from the trial of 3.1
- [x] 5.2 `pnpm check`, every job of `.github/workflows/pr.yml`, `openspec validate v3-306-single-part-wave --strict`, `openspec validate --specs --strict`
