# Tasks

## 1. Free suite check (test first)

- [x] 1.1 Write `plugins/bdk/tests/evals.test.ts` (design D6): loader check at `--max-cost-usd 0` with a temporary `HOME`, output dir and report, failing on `✗` load errors and "cannot pass" warnings; a planted broken case in a temporary copy of the suite that must be detected; every `evals/fixtures/*.sh` and case scaffold run in an empty directory with the scaffold environment and a 120 s limit; case directory names, one of the tags `block`/`orchestrator`/`sample`, block grader kinds, and `git check-ignore` of `evals/results/`. Verify it fails while `plugins/bdk/evals/` is missing.

## 2. Suite, shared fixture and sample case

- [x] 2.1 Add `plugins/bdk/evals/fixtures/tiny-ledger.sh` (D2) and verify it builds a one-commit git repository in an empty directory with an empty `HOME`.
- [x] 2.2 Add the case `plugins/bdk/evals/sample-handover-note/` (D4): `case.yaml` with `plugins: ["plugin"]` and `scaffold.sh` reusing the shared fixture, `prompt.md` tagged `sample`, graders `skill-fired`, `note-created`, `note-format`, `read-before-write`, `reply`; the `bdk-eval-sample` plugin with the `handover-note` skill reviewed against `/skill-creator` guidance; verify `claude plugin validate plugins/bdk/evals/sample-handover-note/plugin --strict` passes.
- [x] 2.3 Add `plugins/*/evals/results/` to `.gitignore` and the `eval` script to `plugins/bdk/package.json` (D5); verify `pnpm --filter @bdk/bdk run eval --help` reaches the pinned `claude plugin eval`.
- [x] 2.4 Write `plugins/bdk/evals/README.md` (run, probe, grants, block and orchestrator cases, shared fixtures, host limits from the design's Context) and the pointer in `CONTRIBUTING.md`; verify each command in it runs as written (the paid ones in 3.1).
- [x] 2.5 Verify `plugins/bdk/tests/evals.test.ts` passes, and that `claude plugin validate plugins/bdk --strict` still passes.

## 3. Acceptance and gates

- [x] 3.1 Acceptance signal: run `pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*'` with and without the plugin and record WITH, W/OUT, Δ and cost in design D4.
- [x] 3.2 Run every check of `.github/workflows/pr.yml` (`pnpm check`, `claude plugin validate` of the marketplace and every plugin with `--strict`, commitlint on the commit), `openspec validate v3-189-eval-setup --strict` and `openspec validate --specs --strict`.
