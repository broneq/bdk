## 1. Exit 3 for an internal error

- [x] 1.1 Write failing tests in `plugins/bdk-skill-kit/src/main.test.ts`: a plugin rule throwing `Error("boom")` gives exit 3, empty stdout and the single stderr line `skill-check: internal error: rule t/boom failed on skills/alpha/SKILL.md: boom`; a throwing `checkProject` names the project check; discovery failing (a skill directory made unreadable with `chmod 000`, `EACCES`) gives one line; a thrown non-`Error` value is printed as text; `SKILL_CHECK_DEBUG=1` adds the stack; `--help` lists exit 3 and `SKILL_CHECK_DEBUG`. Verify: `pnpm vitest run plugins/bdk-skill-kit/src/main.test.ts` fails on them
- [x] 1.2 Wrap rule errors in `src/runner.ts` with rule ID and file (cause kept); map every other error to exit 3 in `src/main.ts` with `SKILL_CHECK_DEBUG`; update `USAGE`. Verify: 1.1 tests pass
- [x] 1.3 Add a test to the `dist/skill-check.mjs` group of `src/main.test.ts` that the built `dist/skill-check.mjs` exits 3 with one stderr line and no stack when a rule throws. Verify: `pnpm vitest run plugins/bdk-skill-kit/src/main.test.ts` passes
- [x] 1.4 Re-run the #310 reproduction (absolute `dirs` entry in a config outside the project) against the rebuilt bundle. Verify: one `skill-check: internal error: ENOENT ...` line, exit 3

## 2. Skill and eval case

- [x] 2.1 With /skill-creator, add the eval case `plugins/bdk-skill-kit/evals/skill-check-internal-error/` (a project whose plugin rule throws; graders: the reply calls it a failure of the checker or its rule, not a skill finding, and nothing is edited) and an `evals/README.md` with the run command and results. Verify: `claude plugin eval plugins/bdk-skill-kit --scaffold --allow-tools Bash Edit --ablation none --case skill-check-internal-error --runs 3` runs the case against the skill text from before this Change
- [x] 2.2 With /skill-creator, add exit 3 to `skills/skill-check/SKILL.md`, as short as the 2.1 numbers allow (design D5). Verify: `node dist/skill-check.mjs` in the kit reports no findings and a run of 2.1 passes its graders

## 3. Docs

- [x] 3.1 Name exit 3 and `SKILL_CHECK_DEBUG` in `plugins/bdk-skill-kit/README.md` (plugin rules section); no `docs/guide/` or `docs/concepts/` page describes `skill-check`; run `pnpm docs:reference`. Verify: `git status docs/reference` shows no unexpected change

## 4. Gates

- [x] 4.1 Run `pnpm check`, `openspec validate --specs --strict` and `pnpm exec claude plugin validate plugins/bdk-skill-kit --strict`. Verify: all exit 0
