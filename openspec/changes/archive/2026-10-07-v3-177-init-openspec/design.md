# Design

## Context

`staging/v3` holds only `docs/`, repo metadata and `.claude-plugin/marketplace.json` (#176). There is no `.github/workflows/`; the full PR CI of ADR-0002 (`check`, `plugins`, `commitlint`, `docs`) comes with #172. `draft/v3-1` ran its roadmap in OpenSpec 1.13.2 with the stock `spec-driven` schema and an `openspec/config.yaml` written for a TypeScript kernel and a numbered task plan (`V3-IMPLEMENTATION-PLAN.md`), both gone in v3 (ADR-0003).

This Change is its own bootstrap: `/opsx:propose` needs `openspec/` and the skills, so `openspec init` and `openspec/config.yaml` were written before the Change was created. The tasks record them as done.

## Goals / Non-Goals

**Goals:**
- Every later v3 task can run the SDLC of `CLAUDE.md` in this repository.
- A broken main spec cannot merge unnoticed.

**Non-Goals:**
- A BDK-specific OpenSpec schema for this repository. ADR-0003 D2-2 defines a BDK schema for user projects (#180); this repository stays on `spec-driven` until that schema exists and is worth dogfooding, which would be its own Change.
- Validating in-flight Changes in CI. The SDLC archives a Change before its PR, so `openspec/changes/` holds only the archive on `staging/v3`.

## Decisions

### Which draft rules still apply

Each rule of `draft/v3-1:openspec/config.yaml`, and what happened to it:

| Draft rule | v3 outcome | Why |
|---|---|---|
| Context: Node / TypeScript kernel, change-centric pipeline | Replaced | ADR-0003: logic in skills, the CLI only helps. |
| Context: plan, design and decision register under `docs/v3/` | Replaced | Sources are now `CLAUDE.md`, the v3 architecture and repo-structure designs, ADR-0002, ADR-0003 and the `docs/v3-draft1/` archive. |
| Context: status tracking, one issue per task on the board | Kept | `CLAUDE.md` SDLC; milestone `v3.0`. |
| Context: living specs only under `openspec/specs/`, never under `docs/` | Kept, generalised | The kernel spec names (`kernel-cli`, `kernel-architecture`) no longer exist. `docs/` now holds the VitePress site, ADRs, designs and archives (ADR-0002). |
| Proposal: name `v3-tnn-<slug>` | Changed to `v3-<N>-<slug>` | Tasks are issues, not plan IDs; matches `CLAUDE.md`. |
| Proposal: first line under "Why" links plan task and issue | Changed to "Tracks #N." | The issue body is the only task scope. |
| Proposal: cite Input by section and decision ID, never reopen a decision | Kept | Same failure mode; IDs are now ADR numbers and D1 / D2-2 / D3-0. |
| Proposal: resolve every "To resolve in the spec" item | Kept | Issue bodies keep the section. |
| Proposal: stay in scope, name the owner of out-of-scope work | Kept | Owner is an issue number instead of a task ID. |
| Specs: Acceptance signal becomes Requirements with scenarios | Kept | Issue bodies keep the section. |
| Specs: `skip_specs: true` for docs-only tasks | Kept | |
| Specs: kernel CLI deltas against `kernel-cli/<group>`, `schema/cli/` and `tests/contract/` in the same PR | Dropped, generalised | No kernel; kept only "write the delta against the existing main spec, never restate it in a new capability". |
| Design: alternatives and why they lost, cite decision IDs | Kept | |
| Tasks: test-first | Kept | |
| Tasks: last group checks the Acceptance signal and validates the change | Kept, extended | Also runs every CI check and `openspec validate --specs --strict`, the gates `CLAUDE.md` requires before a PR. |
| Apply: set the card to "In progress" | Kept | Stated as a check, since `CLAUDE.md` "Start" already does it before the Change. |
| Archive: only after verify; close the issue after the merge | Kept, extended | Adds the main spec sync and the single Conventional Commit from `CLAUDE.md`. |
| (new) Tasks: build a skill with `/skill-creator`, eval case first, helpers only for a recorded problem | Added | `CLAUDE.md` "Building skills (v3)"; ADR-0003 principle 7. |
| (new) Tasks: try a skill only in a separate project with `--plugin-dir` | Added | `CLAUDE.md` "Development Commands". |

### Profile: `custom` with all ten workflows

The `core` profile installs `propose`, `explore`, `apply`, `update`, `sync`, `archive`. `CLAUDE.md` uses `new`, `continue`, `ff` and `verify` as well. The two remaining workflows (`bulk-archive`, `onboard`) have no use in the SDLC and are left out. Alternative: `core` plus hand-copied files - rejected, `openspec update` would delete them.

### CI: a `pr.yml` with one `openspec` job

ADR-0002 names the PR workflow `pr.yml`. This Change creates it with one job, so #172 adds `check`, `plugins`, `commitlint` and `docs` next to it instead of creating a second PR workflow. The job installs the pinned CLI with npm and runs the gate; it needs no pnpm workspace, so it does not wait for #172. OpenSpec telemetry is off by itself when `CI` is set, so no opt-out variable is needed.

Alternative: a separate `openspec.yml` - rejected, ADR-0002 lists three workflow files and a fourth one only for this gate splits the PR checks.

## Risks / Trade-offs

- [The OpenSpec version is pinned in two places, `CLAUDE.md` and `pr.yml`] → Both name `1.13.2`; a bump is one Change that edits both and reruns `openspec update`.
- [`openspec validate --specs --strict` passes with no specs at all] → This Change archives the first main spec (`repo-sdlc`), so the gate checks real content from its first run.
- [The generated `.claude/` files drift from the CLI] → They are regenerated only by `openspec update` with the `custom` profile (`CLAUDE.md`, SDLC); they are not edited by hand.
