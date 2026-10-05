# Proposal

## Why

Scope: #118. Tracks #118.

BDK commits its state under `.bdk/` (Change directories, ledger entries, living specs), all of it Markdown, YAML or JSON written by the kernel. A project whose linter or formatter reads the whole tree reads those files too. The T42 `run-auto` stage probe (2026-10-04) showed both failure modes: the fixture's `markdownlint-cli2` (`globs: ['**/*.md'], gitignore: true`) failed on the committed `.bdk/changes/*.md`, and the round-2 implementer edited `.markdownlint-cli2.mjs` and two package scripts to make lint pass. A formatter in write mode is worse: this Change's probe ran `prettier --write .` over a closed Change and the kernel moved it back to the plan stage (design D3).

## What Changes

- **`/bdk:setup` keeps `.bdk/` out of the project's tools.** A new step after the settings finds the configuration of each tool that reads Markdown, YAML or JSON (and each project script that lists files itself), asks once which exclusions to write, writes the accepted ones, runs the configured `tools.lint` commands once, flags every reported path under `.bdk/`, and commits the edited files in a commit of their own. `references/stacks.md` gains the table of where each known tool reads its ignore list.
- **`setup` may edit and commit project tool configuration.** Its `allowed-tools` gain `Edit`, `Write`, `Bash(git add *)` and `Bash(git commit *)`. The rule that it never edits a file under `.bdk/` stays.
- **Role contracts: a report on BDK's own files is a question.** The `implementer`, `simplifier`, `runner`, `reviewer` and `integration-reviewer` contracts carry one line: a problem caused only by files under `.bdk/` is a `question` entry naming `/bdk:setup`, never a finding and never a change to the project's tool configuration; the roles that run commands never rewrite `.bdk/` files with a formatter. The runner records a check that fails only on `.bdk/` paths as `not-run`.
- **Point 4 answered by an E2E test.** A kernel E2E test runs the pinned `prettier --write` over a project holding a reviewed Change and a merged living spec, and asserts what breaks (graph input hashes, `bdk-merge-hash`) and what does not (the ledger reads, `log list` works). The protection is the setup exclusion and the contract line; the kernel's hashes stay byte-exact (design D3, D4).
- **Stage evals.** The `setup` case `fresh-project` answers yes to the exclusion and expects the commit; the `run-auto` case uses `npm run lint` as `tools.lint` on a fixture with the exclusion applied, and expects that no commit of the run touches the project's tool configuration.

Out of scope:

- `bdk doctor` does not check the exclusion (design D2).
- Tool group states in `/bdk:setup` (T49, #117): whichever of T49 and T51 lands second rebases on the other.
- `bin/bdk` (T52, #119).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stage-skills`: a new requirement for the isolation step of `/bdk:setup`.
- `role-contracts`: a new requirement for problems caused only by `.bdk/` files.
- `kernel-state`: a new requirement recording that the kernel's hashes over committed state stay byte-exact and how a rewrite shows (point 4).

## Impact

- **Skills**: `skills/stages/setup/SKILL.md`, `skills/stages/setup/references/stacks.md`; `skills/roles/{implementer,simplifier,runner,reviewer,integration-reviewer}/SKILL.md`.
- **Tests**: `kernel/tests/contract/stage-skills.test.ts`, `kernel/tests/contract/role-contracts.test.ts`, a new E2E test under `kernel/src/spec/tests/` for point 4.
- **Evals**: `evals/suites/stages/cases/setup.yaml`, `evals/suites/stages/cases/run.yaml`.
- **Docs**: the setup page and the troubleshooting page of `docs/guide/`.
- **Kernel source**: unchanged.
