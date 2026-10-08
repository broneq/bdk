## 1. Eval cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/ledger-planned.sh` (design D9): `ledger-change.sh` plus the two verified plan parts of `add-csv-export`, committed
- [x] 1.2 Write the cases `implement-part-csv` and `implement-part-plan-defect` with their scaffolds and graders (design D9)
- [x] 1.3 Write the cases `conform-part-violations` and `conform-part-behaviour-gap` with their scaffolds (part 01 implemented uncommitted, `execute/part-01.md` done) and graders (design D9)
- [x] 1.4 Run the free check `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`: the cases load and the scaffolds run; confirm in a scaffolded copy that each conform case's tests pass and hold the violation or gap it names, and that the plan-defect part contradicts its scenario

## 2. The blocks

- [x] 2.1 Write the agents `plugins/bdk/agents/implementer.md` and `plugins/bdk/agents/conformer.md` (design D1)
- [x] 2.2 Build `plugins/bdk/skills/implement-part/SKILL.md` with `/skill-creator` (design D1-D5): `!` config block, hand-off, input and run directory, reading, contract check and plan-defect stop, acceptance tests red, tasks, part checks, report, reply
- [x] 2.3 Build `plugins/bdk/skills/conform-part/SKILL.md` with `/skill-creator` (design D1, D2, D6, D7): `!` config block, hand-off, input, implementer report gate, diff, three sources, fix or leave, checks, report, reply
- [x] 2.4 Run `bdk-skill-kit:skill-check` on both skills and both agents and fix every finding; `claude plugin validate plugins/bdk --strict` passes
- [x] 2.5 Add the cases, their grants and run command to `plugins/bdk/evals/README.md`; name the blocks and agents in `CLAUDE.md` "Current state"

## 3. Acceptance end to end

- [x] 3.1 Build the plugin; in test projects scaffolded from each case outside this repository, run `claude -p --plugin-dir plugins/bdk` with the case prompt; check the report's first line and sections, the code and tests on disk, `checks/*.json`, that the named agent did the work, and that `git status` shows no commit or staged change; plus one project without `.bdk/settings.yaml`
- [x] 3.2 Run the eval cases with and without the plugin, fix the skills or graders until they pass, record scores, time, cost and host problems under "Measurements" in design.md

## 4. Gates

- [x] 4.1 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin, the rest of `.github/workflows/`), `openspec validate v3-192-execute-blocks --strict` and `openspec validate --specs --strict`
