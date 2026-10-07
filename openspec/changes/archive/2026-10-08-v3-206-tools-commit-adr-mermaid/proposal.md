# Proposal

## Why

Tracks #206.

v3 removed the v2 tools with the rest of v2 (CLAUDE.md "Current state"). The v3 architecture keeps three of them in scope for v3.0 (design "Catalog", the "Tools" line; skills decisions doc, phase "Skills and agents"): `commit`, `adr` and `mermaid-drawer`. `/bdk:close` composes `commit` (design "Catalog", orchestrators), and a user needs both `commit` and `adr` on their own. `add-rule` and `refine-rules` stay out (issue, "Out of scope").

## What Changes

- New skill `plugins/bdk/skills/commit/` (`/bdk:commit`): commits the user's changes with a message that follows the project's own convention (commitlint, then `CONTRIBUTING.md`, then recent history), picks which files to stage when nothing is staged, never stages a secret or a local artefact, splits unrelated changes into separate commits, adds no agent attribution unless the project's convention asks for one, and never bypasses hooks.
- New skill `plugins/bdk/skills/adr/` (`/bdk:adr`): writes one Architecture Decision Record from a free-form decision or from a decision (`D<N>`) of an OpenSpec Change's `design.md`, in the project's ADR directory and format when it has one and in MADR under `docs/adr/` otherwise, numbered after the highest existing record, and marks the record it replaces as superseded.
- Both skills are written with `/skill-creator` as plain skills with eval cases first (CLAUDE.md "Building skills (v3)", ADR-0003): `plugins/bdk/evals/commit-*` and `plugins/bdk/evals/adr-*`, measured with and without the plugin. Neither needs a `bdk` command or reads the BDK configuration.
- `mermaid-drawer` is not added again: #207 shipped it in `bdk-craft` with three eval cases and a recorded `Δ` of +0.41 (`plugins/bdk-craft/evals/RESULTS.md`), which meets this issue's acceptance signal. Plugins never import from each other (ADR-0002), and a copy in `bdk` would be a second source of the same standard (design D1).
- The architecture's line "Every BDK skill starts with a `!` block running `bdk config show`" is narrowed to skills that read the configuration, so the tools run in any project (design D2).

## Capabilities

### New Capabilities

- `bdk-tools`: the tool skills of the `bdk` plugin, `/bdk:commit` and `/bdk:adr`: what each does, what it never does, and their eval cases.

### Modified Capabilities

None. `skill-evals` already defines the layout, tags and graders the new cases follow; `craft-skills` already covers `mermaid-drawer`.

## Out of scope

- `add-rule` and `refine-rules` (issue, "Out of scope").
- `/bdk:close` and how it calls `commit` (#202).
- Diagram guidance inside `design-draft` (#190).

## Impact

- New: `plugins/bdk/skills/commit/`, `plugins/bdk/skills/adr/` (with `references/`), `plugins/bdk/evals/commit-*/`, `plugins/bdk/evals/adr-*/`, spec `bdk-tools`.
- Changed: one sentence in `docs/design/2026-10-07-v3-architecture.md` ("Configuration and extension points"), the plugin list in `CLAUDE.md` ("Current state").
- Ships in the released `bdk` plugin (`skills/`); `evals/` does not ship. No CLI, hook, `package.json` or lockfile change.
