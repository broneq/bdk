# Tasks

## 1. Offline gh stand-in (problem recorded in design D8)

- [x] 1.1 Failing tests first in `plugins/bdk/tests/evals.test.ts`: `fixtures/bin/gh issue view` with `--json` fields, the text form, `#<n>`/URL/`--repo` references, an unknown issue, an unsupported command
- [x] 1.2 Write `plugins/bdk/evals/fixtures/bin/gh` (Node, executable) until the tests pass

## 2. Eval cases first

- [x] 2.1 Write the shared fixture `plugins/bdk/evals/fixtures/tiny-ledger-bdk.sh` (tiny-ledger configured for BDK, schema copied from the plugin, main spec `ledger`)
- [x] 2.2 Write the cases `propose-from-issue`, `propose-from-intent`, `propose-not-configured` (prompt, `case.yaml`, `scaffold.sh`, graders per design D9); the issue case writes `.git/bdk-eval/issues/42.json`
- [x] 2.3 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see the cases load; probe one case without the skill to see it fail

## 3. The skill

- [x] 3.1 Build `plugins/bdk/skills/propose/SKILL.md` with `/skill-creator` (design D1-D7)
- [x] 3.2 Run `bdk-skill-kit:skill-check` on the skill and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 3.3 Add the propose cases, their grants and the `PATH` with the stand-in to `plugins/bdk/evals/README.md`; add the skill to `CLAUDE.md` "Current state"

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in separate test projects scaffolded from each case (outside this repository), run `claude -p "/bdk:propose ..." --plugin-dir plugins/bdk` with the stand-in on `PATH`; check `proposal.md` against the spec scenarios, `openspec status --change <name>` shows `proposal` done, `.openspec.yaml` says `schema: bdk`, and a second run keeps the proposal
- [x] 4.2 Check the real `gh issue view <n> --json number,title,body,labels,state,url` output has the shape the stand-in prints
- [x] 4.3 Run the eval cases with and without the plugin (`--runs 1`) and fix the skill or graders until the with-arm passes; record the results in design D9
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-197-bdk-propose --strict` and `openspec validate --specs --strict`
