# Tasks

## 1. Host facts

- [x] 1.1 Add a `plugin-bin` check to `tests/host-probe/run-headless.sh` with a probe executable under `tests/host-probe/bin/`, a probe skill whose `!` block calls it with `allowed-tools: Bash(<probe> *) Bash(echo *)`, and a probe hook that calls it; verify by running the check from a scratch project and keeping its payloads under `tests/fixtures/host-payloads/<version>/`
- [x] 1.2 Record the rows `plugin-bin-bash` (main thread and subagent), `plugin-bin-skill` and `plugin-bin-hook` in `docs/HOST-FACTS.md` with the Claude Code version and the fixture names; verify that `pnpm test:contract` (the `bdk ...` mention check over HOST-FACTS) passes

## 2. Launcher and `--version`

- [ ] 2.1 Write the failing tests: the launcher passes argv, stdin and the exit code through, exits 5 with the `kernel unavailable` line without `node` or without the bundle, and is tracked as `100755` with `eol=lf`; `bdk --version` and `bdk --version --json` answer like `bdk version`; verify that they fail
- [ ] 2.2 Add `bin/bdk` (POSIX `sh`, design D1) with mode `100755` and a `.gitattributes` entry `bin/bdk text eol=lf`; map a first argument `--version` to `version` in the registry and name it in the global help; verify with the tests of 2.1, `pnpm test:unit` for the registry and `claude plugin validate .`
- [ ] 2.3 Edit the Purpose of `openspec/specs/kernel-cli/spec.md` directly (the delta cannot): replace "The only supported invocation is `node ...`; no PATH shim is installed" with the two entry points of Invocation; verify with `openspec validate --specs --strict`

## 3. Guards

- [ ] 3.1 Write the failing tests in `kernel/src/hooks/tests/`: `pre-tool.sh` starts the kernel for a subagent `bdk commit 01-1` and for a main-thread `cd app && bdk hooks pre-tool`, and the kernel denies them with the same rules as the `node .../bdk.mjs` form; a contract test asserts that no command in `hooks/hooks.json` or `hooks/guard/*.sh` runs `bdk` as a command word; verify that the prefilter tests fail
- [ ] 3.2 Extend the prefilter of `hooks/guard/pre-tool.sh` with `bdk ` next to `bdk.mjs` (design D5) and update its header comment; verify with the tests of 3.1, `pnpm test:e2e` for the guard E2E and `pnpm test:perf` for the guard latency budget

## 4. Skills and role contracts

- [ ] 4.1 Point the failing content checks at the new form: `skill-check.config.ts` reads the pair from the spec unchanged, the contract tests (`skill-context`, `stage-skills`, `tools-skills`, `review-skills`, `craft-skills`, `startup`, `openspec-compat`) assert `bdk` in place of the bundle path where they pin it; run `pnpm skill-check` and `pnpm test:contract` and verify that they fail on every skill
- [ ] 4.2 Rewrite every `SKILL.md` under `skills/` and `evals/suites/execute-ab/variants/`: the `!` wrapper, the fallback sentence, `allowed-tools: Bash(bdk *) Bash(echo *)`, and the removal of the "Run kernel commands as `node ...`" sentence; `/bdk:bdk-cli` names `bdk <group> <verb> --json` and lists `Bash(bdk *)`; verify with `pnpm skill-check` and `pnpm test:contract`, and that `grep -rn 'bdk\.mjs\|CLAUDE_PLUGIN_ROOT}/dist' skills/` is empty
- [ ] 4.3 Check the other kernel-facing texts for the path form (`STARTUP_INSTRUCTIONS.md`, `fragments/`, the dispatch package rendering in `kernel/src/dispatch/`, `rules/`); keep the `${CLAUDE_PLUGIN_ROOT}` substitution of role bodies for references; verify with `pnpm test:unit` and a `bdk dispatch build` output that names no bundle path

## 5. Evals

- [ ] 5.1 Write the failing tests in `evals/suites/stages/`: `prepare` runs with `<plugin copy>/bin` first on `PATH` and a case line `bdk config set ...` writes the setting; a run whose transcript holds a Bash call naming `bdk.mjs` fails with a failure naming the command; `kernelCalls` of the execute-ab metrics counts `bdk next` as a kernel call; verify that they fail
- [ ] 5.2 Implement them: prepend the plugin copy's `bin/` in `evals/suites/stages/hooks.ts` (and in seeds that run shell lines), drop `$BDK`, rewrite the case files under `evals/suites/stages/cases/` to `bdk ...`, add the transcript check, widen `kernelCalls`; verify with `pnpm test:unit` and `pnpm eval check`

## 6. Documentation

- [ ] 6.1 Update README (installation: `bin/bdk`, Node, the unsupported claude.ai / Cowork hosts, the shadowing cause next to the STOP line), CONTRIBUTING.md, CLAUDE.md, `.claude/rules/skills.md`, `openspec/config.yaml` context, `evals/README.md` and `docs/guide/`; verify with `pnpm docs:build`, `pnpm format:check` and `pnpm test:contract` (docs drift guards)

## 7. Acceptance

- [ ] 7.1 In a clean scratch project with the plugin loaded by `--plugin-dir`, run `bdk --version` through the Bash tool of a `claude -p` session and verify the version line
- [ ] 7.2 Verify that the guards deny a subagent `bdk commit` and a main-thread `bdk hooks pre-tool` with the same rules as today's form, through `pnpm test:e2e`
- [ ] 7.3 Run `claude plugin validate .` and verify `Validation passed`
- [ ] 7.4 Run the full gate: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip && pnpm test:unit && pnpm test:e2e && pnpm test:contract && pnpm skill-check && pnpm eval check`
- [ ] 7.5 Run `pnpm eval stages --probe`, show its cost projection to the user, and after approval verify that every case passes with no Bash call naming `bdk.mjs` in any transcript
- [ ] 7.6 Run `openspec validate v3-t52-bdk-bin --strict`
