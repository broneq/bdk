# Proposal

## Why

Tracks #281.

The SDLC in `CLAUDE.md` asks a new issue to "name its blockers with 'blocked by' links" but gives no command for it and no step that makes anyone look. Issues get created without a dependency check, the `Dependencies` section is sometimes left out, and the **Pick** step ("blockers all closed") can only be as good as the links. The dependency review of the v3.0 issues had to repair this by hand.

## What Changes

- The **Create** step of the SDLC in `CLAUDE.md` gets a dependency analysis for every new issue: read the open and recently closed issues of the milestone, decide what the new issue needs first, what it conflicts with, and what it blocks. The result is either the links or an explicit `None.` in the body's `Dependencies` section, never a missing section.
- The step gives the exact, tested commands: `gh issue create --blocked-by ... --blocking ...`, `gh issue edit N --add-blocked-by ... --add-blocking ...` (and `--remove-...`), and reading the relations with `gh issue view N --json blockedBy,blocking`.
- The **Pick** step gives the command that reads a candidate's open blockers.
- The project context in `openspec/config.yaml` states the same rule for the `Dependencies` section.
- `openspec/specs/repo-sdlc` gets a requirement for it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repo-sdlc`: added requirement - every new issue carries a dependency analysis, recorded as "blocked by" relations or an explicit `None.`, with the commands in the SDLC.

## Impact

- `CLAUDE.md` (SDLC Create and Pick), `openspec/config.yaml` (context), `openspec/specs/repo-sdlc/spec.md`.
- No change to anything a BDK user sees: the rule governs how this repository files its own issues. No `docs/guide/` or `docs/concepts/` page changes; `CONTRIBUTING.md` already defers to the SDLC in `CLAUDE.md`.
