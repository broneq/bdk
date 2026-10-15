## 1. Eval cases first

- [x] 1.1 `propose-conditional-ac` (block): tiny-ledger with a seed helper `seedEntries(amounts)` that cannot mark an entry void, issue 42 with a conditional point, an acceptance step by hand and a comment, `policy.questions: decide-and-record`; graders on `source/issue.md` word for word, the AC with the condition and the step, `explore/propose-recon.md` naming `seedEntries` with `file:line`, the open `By: needs-user` entry, the recon agent and the skill firing
- [x] 1.2 `verify-design-dropped-ac` and `verify-design-dropped-ac-user` (block) on `ledger-designed`: source, Acceptance, a design that leaves out an AC with `Decided without the user:`; without and with a `By: user` log entry; graders on the verdict and the item naming the AC
- [x] 1.3 `design-intent-page` (orchestrator): a passing design whose log holds a `Stage: design`, `By: user` entry that changes an AC, gate `auto`; graders on `design/intent.html` (struck intent, AC row `changed`, svg, meta), the `lavish-axi` open, the designer before the open, `gate.md` with `Scope log: SL-<n>`
- [x] 1.4 `run-needs-user` (orchestrator): a queue of two Changes, the first proposed with an open `By: needs-user` entry, under `decide-and-record`; graders on `run.json` marking it, no stage skill for it, a stage skill for the second Change
- [x] 1.5 Move the graders and fixtures that name `design/explore.md` to `explore/design.md` with its front matter; `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` loads every case

## 2. Schema and propose

- [x] 2.1 Add `## Intent` and `## Acceptance` to the BDK schema's proposal instruction and template, with a failing assertion in `plugins/bdk/tests/openspec-schema.test.ts` first
- [x] 2.2 Rewrite `skills/propose/SKILL.md` with /skill-creator: source saved, Intent and Acceptance, scope log, recon, one decision round with AC decisions kept for the user, index, report
- [x] 2.3 New skill `skills/recon/SKILL.md` with /skill-creator, on `bdk:explorer`; update `agents/explorer.md` to name it

## 3. Design stage

- [x] 3.1 `skills/explore/SKILL.md`: map at `explore/design.md` with front matter, reads recon
- [x] 3.2 `skills/design/SKILL.md`: map path, index, `Needs user:` stop, intent page at the gate, `Scope log:` in `gate.md`
- [x] 3.3 `skills/design-draft/SKILL.md` and a new `references/intent-page.md`: reads source, log and index; AC coverage; scope-log entries; `needs-user` under decide-and-record; open entries asked first; the intent page mode
- [x] 3.4 `skills/verify-design/SKILL.md`: the AC reference and its `Must address` items; "outside the proposal" no longer excuses an AC

## 4. Later verifiers, close and run

- [x] 4.1 `skills/verify-plan/SKILL.md`: every AC carried by a part
- [x] 4.2 `skills/review-integration/SKILL.md`: AC followed through the code
- [x] 4.3 `skills/spec-conformance/SKILL.md`: AC met, deferred is no coverage
- [x] 4.4 `skills/close/SKILL.md`: `Scope changes` part of the pull request body
- [x] 4.5 `skills/run/SKILL.md`: `needs-user` marking, skipping and final report
- [x] 4.6 `bdk-skill-kit:skill-check` on every touched skill and agent

## 5. Try in a test project

- [x] 5.1 Run `/bdk:propose` on a scratch project with `claude --plugin-dir plugins/bdk` (never in this repository) and read the files it writes: done through the eval cases `propose-conditional-ac` and `propose-from-issue`, which run Claude Code with the plugin in a scaffolded project and grade the files it writes

## 6. Docs

- [x] 6.1 `docs/concepts/stages.md`: propose's new files, the decision round, the AC as the reference of every verifier; its flow diagram
- [x] 6.2 `docs/concepts/run-state.md`: `source/`, `explore/` (index, recon, map), `scope-log.md`, `design/intent.html`, `Scope log:` of `gate.md`; the file layout, the reader table and the design-and-plan diagram
- [x] 6.3 `docs/concepts/orchestrators.md`: `/bdk:propose` steps and diagram, `/bdk:design` resume table, gate and diagram, `/bdk:run` `needs-user` and its diagram, `/bdk:close` body
- [x] 6.4 `docs/concepts/agents.md` (recon on `bdk:explorer`, the map path), `docs/concepts/workflow.md` and `docs/concepts/gates-and-budgets.md` (AC decisions never by a setting, `needs-user`), `docs/guide/workflow.md` (what propose writes, the intent page at the gate)
- [x] 6.5 `pnpm docs:reference`

## 7. Verify

- [x] 7.1 Acceptance signal: run the new cases and one regression probe per touched block with `--runs 1 --ablation none --model sonnet`, record each run's cost and time in `design.md` (Budget: at most $25)
- [x] 7.2 Run every check CI runs (`pnpm check`, `pnpm docs:reference` with no diff, the docs build), `openspec validate v3-422-propose-acceptance --strict` and `openspec validate --specs --strict`
