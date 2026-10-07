# Tasks

## 1. Fixture and eval cases first

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/ledger-proposal.sh` (design D8): tiny-ledger plus a store module, `.bdk/settings.yaml`, OpenSpec with the BDK schema copied from the plugin, the Change `add-csv-export`; verify it runs in an empty directory under the harness environment and `bdk config show` reports the project configured
- [x] 1.2 Write the six case directories `explore-csv-export`, `design-draft-lavish`, `design-draft-ask`, `design-draft-auto`, `verify-design-false-claim`, `verify-design-second-pass` (prompt, `case.yaml`, `scaffold.sh`, graders per design D8), with the `lavish-axi` stubs as local `node_modules` packages
- [x] 1.3 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see it load the new cases

## 2. Agents

- [x] 2.1 Write `plugins/bdk/agents/explorer.md` and `plugins/bdk/agents/verifier.md` (design D7; `verifier.md` copied verbatim from #191); `claude plugin validate plugins/bdk --strict` passes

## 3. Skills, each with `/skill-creator`

- [x] 3.1 Build `skills/explore/SKILL.md` (design D1-D3): `!` config block, hand-off to `bdk:explorer`, Change resolution, the five sections with `file:line`, follow-up continuation, short reply
- [x] 3.2 Build `skills/verify-design/SKILL.md` (design D2, D3, D6): hand-off to `bdk:verifier`, checks, Must / Should split, D6 body, `Closed:` line and stable IDs from the previous report, continuation
- [x] 3.3 Build `skills/design-draft/SKILL.md` and `references/approaches.md` (design D4, D5): inputs, schema instructions, approaches and self-critique, questions by policy / Lavish / `AskUserQuestion` / reply, fix mode for a failed report, `openspec validate`
- [x] 3.4 Run `bdk-skill-kit:skill-check` on the three skills and two agents and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 3.5 Add the design-block cases, their Bash grants and the run command to `plugins/bdk/evals/README.md`

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in a separate test project scaffolded from `ledger-proposal.sh` (outside this repository) run `claude -p "/bdk:explore add-csv-export" --plugin-dir plugins/bdk`, then `/bdk:design-draft` with `decide-and-record`, then `/bdk:verify-design`; check the run files, the spec delta, `design.md`, and that `git status` shows nothing else changed
- [x] 4.2 In the same project, continue a verifier with `SendMessage` after a fix (one `claude -p` session that starts the agent, edits the design and continues it) and check `verify-2.md` lists closed IDs
- [x] 4.3 Run the eval cases with and without the plugin (`--runs 1`, grants per README), fix skills or graders until each block scores higher with the plugin, and record the results in a "Results" section of design.md
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-190-design-blocks --strict` and `openspec validate --specs --strict`
