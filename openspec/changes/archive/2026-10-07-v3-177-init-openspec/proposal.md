# Proposal

## Why

Tracks #177.

The SDLC in `CLAUDE.md` runs every task as an issue, an OpenSpec Change and a PR into `staging/v3`, but `staging/v3` has no `openspec/` directory, no `/opsx:*` commands and no CI, so no task can follow it. This Change sets OpenSpec up in this repository, so that every later v3 task (#172 onward) can run as a Change and its specs are checked on every PR.

## What Changes

- OpenSpec 1.13.2 is initialised in the repository for Claude Code with the `custom` profile: the ten workflows `propose`, `explore`, `new`, `continue`, `apply`, `update`, `ff`, `sync`, `archive` and `verify`, delivered as skills (`.claude/skills/openspec-*`) and commands (`.claude/commands/opsx/*`). The `core` profile lacks `ff`, `new`, `continue` and `verify`, which `CLAUDE.md` relies on.
- `openspec/config.yaml` carries the v3 project context and the artifact rules, adapted from `draft/v3-1:openspec/config.yaml` (see design.md, "Which draft rules still apply").
- `.github/workflows/pr.yml` gets its first job, `openspec`, which runs `openspec validate --specs --strict` on every pull request.
- `.gitignore` keeps Claude Code machine-local files (`.claude/settings.local.json`, `.claude/scheduled_tasks.lock`) out of git, now that `.claude/` holds tracked files.
- The first main spec, `repo-sdlc`, records what the repository's development workflow guarantees.

## Capabilities

### New Capabilities

- `repo-sdlc`: the development workflow of this repository - OpenSpec setup and the CI gate that validates the main specs.

### Modified Capabilities

None. `openspec/specs/` is empty.

## Impact

- New files: `openspec/config.yaml`, `openspec/specs/`, `openspec/changes/archive/`, `.claude/skills/openspec-*/SKILL.md`, `.claude/commands/opsx/*.md`, `.github/workflows/pr.yml`.
- Changed files: `.gitignore`.
- Contributors need the OpenSpec CLI 1.13.2 with the `custom` profile (already stated in `CLAUDE.md`, SDLC).
- Out of scope: the other `pr.yml` jobs (`check`, `plugins`, `commitlint`, `docs`), the workspace and the release flow (#172); the BDK OpenSpec schema that BDK installs into user projects (#180, ADR-0003 D2-2).
