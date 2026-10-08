## 1. Offline gh stand-in for pull requests (eval infrastructure, design D8)

- [x] 1.1 Failing tests first in `plugins/bdk/tests/evals.test.ts`: `gh pr create` writes `.git/bdk-eval/prs/1.json` and prints the URL (`--body-file` and `--body`), refuses a missing `--base`/`--head`/`--title` and a second open PR of the same head; `gh pr view <head>` with and without `--json`, and its "no pull requests found" error; other `pr` commands still fail naming the stand-in
- [x] 1.2 Extend `plugins/bdk/evals/fixtures/bin/gh` until the tests pass

## 2. Eval cases first

- [x] 2.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-reviewed.sh` (tally-change, bare remote `.git/bdk-eval/remote.git` as `origin` with `origin/HEAD`, passing review round, E2E PASS, stand-in copied)
- [x] 2.2 Write the cases `close-reviewed-change` and `close-conformance-fail` (prompt, `case.yaml`, `scaffold.sh`, graders per design D8)
- [x] 2.3 Run the free check (`pnpm exec vitest run plugins/bdk/tests/evals.test.ts`) and see the cases load

## 3. The skill

- [x] 3.1 Build `plugins/bdk/skills/close/SKILL.md` with `/skill-creator` (design D1-D7)
- [x] 3.2 Run `bdk-skill-kit:skill-check` on the skill and fix every finding; `claude plugin validate plugins/bdk --strict`
- [x] 3.3 Add the close cases and their grants to `plugins/bdk/evals/README.md`; add the skill to `CLAUDE.md` "Current state"

## 4. Acceptance end to end

- [x] 4.1 Build the plugin; in separate test projects scaffolded from each case (outside this repository), run `claude -p "/bdk:close add-total" --plugin-dir plugins/bdk` with the stand-in on `PATH`; check archive, commits, push to the bare remote, PR record and `close/pr.md` against the spec scenarios; check the FAIL project stops before archive; check `bdk run status` reports `done` after close; check resume after a failed push
- [x] 4.2 Check the real `gh pr view --json url,state` and `gh pr create` output have the shape the stand-in prints
- [x] 4.3 Run the two orchestrator cases (`--ablation none`) and fix the skill or graders until they pass; record the results in design "Measurements"
- [x] 4.4 Run every CI check (`pnpm check`, `claude plugin validate` of the marketplace and every plugin), `openspec validate v3-202-bdk-close --strict` and `openspec validate --specs --strict`
