## 1. Reproduce and baseline

- [x] 1.1 Extract the refusal list per rule from both probe `output.json` files (counts must match the table in #109) and note the lines each agent followed; keep the notes in the PR description, not the repo
- [x] 1.2 Set the tracking issue #109 card to "In progress" on the project board

## 2. Kernel: citation hint

- [x] 2.1 Write failing unit tests for the three scenarios of the `evidence record` citation hint (one file, no file, two files)
- [x] 2.2 Implement the hint in `kernel/src/evidence/domain/citation.ts` and `use-cases/record.ts`; tests pass

## 3. Kernel: empty reason

- [x] 3.1 Write failing tests: `reason: ""` and `reason: null` on `done` and `done-with-concerns` are stored without `reason`; on `blocked` still refused
- [x] 3.2 Implement in `kernel/src/log/use-cases/ingest.ts` (`checkEnvelope`); tests pass

## 4. Kernel: attempt show

- [x] 4.1 Write failing tests for `bdk attempt show` (open, closed, unknown ticket) and the schema/spec pairing check
- [x] 4.2 Add the use case, command, output schema and registration under `kernel/src/attempt/`; update `schema/cli/commands.json` and `schema/cli/output/`; tests pass

## 5. Contracts and package

- [x] 5.1 Write failing contract tests: runner citation example; envelope example parses with `reason` unset in every role; lead orders close after steps and names the task ticket; `--ticket` on `log add`; package `Return` names the 120 limit, entry types and pipe form
- [x] 5.2 Edit `skills/roles/{lead,runner,implementer,simplifier}/SKILL.md` (and the other roles that carry the envelope example) and `kernel/src/dispatch/domain/template.ts`; tests pass
- [x] 5.3 Run `skill-check` on the changed skills; fix size or reference findings without raising baselines

## 6. Probe refusal counts

- [x] 6.1 Write a failing test for refusal counting per rule in the `execute` probe results row and the acceptance comparison
- [x] 6.2 Implement the counting in `evals/suites/stages/`; test passes

## 7. Docs and build

- [x] 7.1 Rebuild `dist/bdk.mjs`; regenerate generated docs (command list, `STARTUP_INSTRUCTIONS.md` if it changes) with the repo's generator, never by hand
- [ ] 7.2 Run `/docs-sync` for the user docs that list `attempt` commands or role contracts

## 8. Specs

- [x] 8.1 Sync the delta specs into the main specs (`openspec-sync-specs`), so `tests/contract/` sees `bdk attempt show`; archive then runs with the specs already synced

## 9. Acceptance

- [ ] 9.1 Run `pnpm eval stages --skill execute --probe`; record the row; check 3/3 with no `policy/missing-citation`, `input/invalid-envelope`, `policy/no-open-ticket`, `input/unknown-command`, `input/unknown-flag`, and a total below 21
- [ ] 9.2 If a fixed rule appears, read the raw run, fix at its cause, rerun
- [ ] 9.3 Run `openspec validate v3-t46-kernel-refusals --strict`
