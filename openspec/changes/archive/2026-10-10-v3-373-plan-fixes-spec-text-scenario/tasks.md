## 1. Eval cases

- [x] 1.1 Add the graders `delta-task-scenario` and `delta-task-validated` to `plugins/bdk/evals/plan-fixes-spec-delta/graders/` and run the case against the current skill (the reproduction)
- [x] 1.2 `fixtures/tally-spec-fix-part.sh`: the fixture part's task names its `#### Scenario:` and its `Verified by:` names `openspec validate add-total --strict`
- [x] 1.3 Add the graders `delta-has-scenario` and `delta-validated` to `plugins/bdk/evals/implement-part-spec-delta/graders/`
- [x] 1.4 Add the block case `plugins/bdk/evals/conform-part-spec-invalid/` (part built, requirement without a scenario, report done; graders: `Verdict: FAIL`, task 1 under `Left`, no edit of the delta, the agent and skill fired)
- [x] 1.5 Name the cases, graders and the `Bash(openspec validate *)` grant in `plugins/bdk/evals/README.md`

## 2. Skills (with /skill-creator)

- [x] 2.1 `skills/plan-fixes/SKILL.md`: a spec-text task that adds a requirement names at least one `#### Scenario:` with WHEN and THEN; its `Verified by:` names `openspec validate <change> --strict`; the acceptance-scenario rule reworded
- [x] 2.2 `skills/implement-part/SKILL.md`: step 6 validates a part that changed a delta, three runs, `## Checks` line; `allowed-tools` gets `Bash(openspec validate *)`
- [x] 2.3 `skills/conform-part/SKILL.md`: step 4 validates a changed delta, an error is a `Left` item naming the task, spec text is never added by the conformer; `allowed-tools` gets `Bash(openspec validate *)`
- [x] 2.4 Run `plan-fixes-spec-delta` and `conform-part-spec-invalid` (both arms), `implement-part-spec-delta` and `conform-part-spec-delta` (3 runs) against the new skills and record the results in `plugins/bdk/evals/README.md`

## 3. Docs

- [x] 3.1 `docs/concepts/findings.md` (a spec-text fix plans its scenario and is validated) and `docs/concepts/orchestrators.md` (the validation in the part flow: the attempts flowchart and the sequence diagram of one part redrawn, and "Where execute runs your checks")
- [x] 3.2 Run `pnpm docs:reference`

## 4. Gates

- [x] 4.1 Check the acceptance signal: `plan-fixes-spec-delta` plans the scenario and the validation in its runs with the plugin; `conform-part-spec-invalid` fails the part
- [x] 4.2 `pnpm check`, every check in `.github/workflows/`, `openspec validate v3-373-plan-fixes-spec-text-scenario --strict` and `openspec validate --specs --strict`
