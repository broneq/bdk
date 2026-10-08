## 1. Eval cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-queue.sh` on `tally-reviewed.sh`: a second reviewed Change `add-count` on its own branch from `main`, issues 1 and 2 in the `gh` stand-in store, and `.bdk/runs/run.json` with both Changes (design D8)
- [x] 1.2 Write the cases `run-two-prs`, `run-resume`, `run-waiting-blocker` and `run-queue-from-issues` (prompt, `case.yaml`, `scaffold.sh`, graders per design D8)
- [x] 1.3 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see the cases load and the scaffolds exit 0; check `bdk run status` accepts each scaffolded `run.json`

## 2. `/bdk:propose --name`

- [x] 2.1 Add `--name <change>` to `plugins/bdk/skills/propose/SKILL.md` with `/skill-creator` (spec delta `bdk-propose`, design D2)

## 3. The skill

- [x] 3.1 Build `plugins/bdk/skills/run/SKILL.md` with `/skill-creator` (design D1-D7)
- [x] 3.2 Run `bdk-skill-kit:skill-check` on both skills and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 3.3 Add the run cases and their grants to `plugins/bdk/evals/README.md`; add the skill to `CLAUDE.md` "Current state"

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in separate test projects scaffolded from each case (outside this repository), run the case prompt with `claude -p ... --plugin-dir plugins/bdk` and the stand-in on `PATH`; check two PRs, resume, waiting and queue order against the spec scenarios
- [x] 4.2 Run the four orchestrator cases (`--ablation none`) and fix the skill or graders until they pass; record the results in design "Measurements"
- [x] 4.3 One run from an intent queue of two Changes in a scratch `tally` project with a bare remote, `policy.gates.*: auto` and `policy.questions: decide-and-record`: both Changes end with a PR into `main`, the second branch holds no commit of the first; record it in design "Measurements"
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-203-bdk-run --strict` and `openspec validate --specs --strict`
