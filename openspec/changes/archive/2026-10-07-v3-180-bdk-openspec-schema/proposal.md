# Proposal

## Why

Tracks #180.

ADR-0003 (D2-2) makes OpenSpec with a BDK schema the living documentation of a BDK project: the Change artifacts match the BDK stages, and `openspec archive` merges the spec deltas into `openspec/specs/`. The architecture design fixes the shape of that schema (`docs/design/2026-10-07-v3-architecture.md`, "Change artifacts: the BDK OpenSpec schema"): artifacts `proposal`, `specs`, `design` and `plan`, where `plan` generates one file per part with `id`, `depends-on`, `isolation` and `files` in its frontmatter, and no `apply.tracks`. No such schema exists yet, so `/bdk:setup` (#181) has nothing to install and the stage skills (`/bdk:propose` #197, `/bdk:design` #198, `/bdk:plan` #199) have no artifact contract to write against.

## What Changes

- New OpenSpec project schema `bdk` shipped in the `bdk` plugin at `plugins/bdk/openspec/schemas/bdk/`: `schema.yaml` and one template per artifact. The directory mirrors its install target, so installing it is copying it to `openspec/schemas/bdk/` of a project.
- Four artifacts in BDK stage order: `proposal` (`proposal.md`: why, what changes, capabilities, impact), `specs` (`specs/**/*.md`: requirement and scenario deltas), `design` (`design.md`: decisions with alternatives, Mermaid diagrams), `plan` (`plan/parts/*.md`: one file `NN.md` per part).
- The part format: YAML frontmatter with `id` (the two-digit file stem), `depends-on` (ids of earlier parts), `isolation` (`worktree` or `shared`) and `files` (paths the part may change), then the part's tasks as contracts and its acceptance scenarios taken from the specs.
- No `apply` section with `tracks`: progress of the work is run state (design section "Run state, run artifacts and resume"), not a checklist inside the Change.
- An integration test that runs the pinned OpenSpec CLI (1.13.2, the version `CLAUDE.md` and PR CI pin) against the shipped schema in a temporary project: `schema validate`, `new change --schema bdk`, `status`, `validate --strict` and `archive`. `@fission-ai/openspec` becomes an exact dev dependency of `plugins/bdk`.
- The shipped directory reaches users through the release snapshot: `scripts/publish-plugin.ts` ships every path of a plugin outside `src`, `tests`, `evals` and `node_modules`.

### Resolved from "To resolve in the spec"

- **Artifact templates and instructions:** resolved in design.md (D3-D6) and specified in `bdk-openspec-schema`. The templates and instruction texts are part of this Change.
- **Fallback if project schemas change in a later OpenSpec release:** resolved in design.md (D7). OpenSpec stays pinned at 1.13.2; the integration test fails on any OpenSpec version that no longer accepts or archives the schema, so a version bump cannot land unnoticed. If a later release drops or breaks project schemas, the fallback named in the architecture risk table applies: the stock `spec-driven` schema for proposal, specs and design, with BDK plan parts kept as plain files at the same `plan/parts/NN.md` path, which BDK skills read directly and which never depended on OpenSpec tracking. Checking the installed schema in a user project is `bdk config check` (#179).

### Out of scope

- Installing the schema into a project, OpenSpec init and the OpenSpec version pin in a user project: `/bdk:setup` (#181).
- Validating a project's installed schema: `bdk config check` (#179).
- Checking part sizes, `depends-on` cycles, waves and overlapping `files`: `bdk plan check` (#185).
- Reading part state and run state: `bdk run status` (#188).
- Writing the artifacts: the blocks and orchestrators (#190, #191, #197, #198, #199).
- Switching this repository's own workflow to the `bdk` schema: this repository stays on `spec-driven` (`openspec/config.yaml`).

## Capabilities

### New Capabilities

- `bdk-openspec-schema`: the BDK OpenSpec project schema shipped in the `bdk` plugin - where it lives and how it installs, its artifacts and their order, the plan part format, no apply tracking, and its compatibility with the pinned OpenSpec version (new Change, status, archive).

### Modified Capabilities

None. `bdk-plugin` specifies the package, launcher, build and marketplace entry, none of which changes; `plugin-release` already ships every non-development path of a plugin.

## Impact

- New: `plugins/bdk/openspec/schemas/bdk/` (`schema.yaml`, `templates/`), `plugins/bdk/tests/openspec-schema.test.ts`, `openspec/specs/bdk-openspec-schema/` (through archive).
- Changed: `plugins/bdk/package.json` (`@fission-ai/openspec` 1.13.2 dev dependency), `pnpm-lock.yaml`.
- Users: none until the first `bdk--v*` release; then the released plugin carries the schema for `/bdk:setup` to install.
- Parallel work: #179 adds runtime dependencies to `plugins/bdk/package.json`; the second PR to merge keeps both and regenerates the lockfile with `pnpm install`.
