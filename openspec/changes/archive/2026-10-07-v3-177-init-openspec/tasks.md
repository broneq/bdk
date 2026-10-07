# Tasks

## 1. Bootstrap (done before the Change existed, see design.md "Context")

- [x] 1.1 Set the global OpenSpec profile to `custom` with `propose`, `explore`, `new`, `continue`, `apply`, `update`, `ff`, `sync`, `archive` and `verify`; verify with `openspec config list`
- [x] 1.2 Run `openspec init --tools claude` with OpenSpec 1.13.2; verify that ten `.claude/skills/openspec-*` skills, ten `.claude/commands/opsx/*` commands, `openspec/specs/` and `openspec/changes/archive/` exist
- [x] 1.3 Write `openspec/config.yaml` with the v3 context and the rules of design.md "Which draft rules still apply"; verify that `openspec instructions proposal --change v3-177-init-openspec --json` returns the context and the `v3-<N>-<slug>` naming rule

## 2. Repository hygiene

- [x] 2.1 Add `.claude/settings.local.json` and `.claude/scheduled_tasks.lock` to `.gitignore`; verify `git status --short` lists no machine-local `.claude/` file

## 3. CI gate

- [x] 3.1 Show the gate catches a defect first: put a requirement without a scenario into a scratch main spec, run `openspec validate --specs --strict` and confirm a non-zero exit naming that spec; then remove the scratch spec
- [x] 3.2 Create `.github/workflows/pr.yml` with the job `openspec` (on `pull_request`, `ubuntu-latest`, Node 24, `npm install --global @fission-ai/openspec@1.13.2`, `openspec validate --specs --strict`); verify with `actionlint`

## 4. Acceptance

- [x] 4.1 Confirm `/opsx:propose` created this Change: `openspec status --change v3-177-init-openspec` shows proposal, specs, design and tasks done
- [x] 4.2 Run `openspec validate v3-177-init-openspec --strict`, then sync the `repo-sdlc` main spec and run `openspec validate --specs --strict`; both pass
- [x] 4.3 After the PR is open, confirm the `openspec` job ran on it and passed
