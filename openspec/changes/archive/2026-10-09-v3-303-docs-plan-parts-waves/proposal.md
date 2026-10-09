# Proposal

## Why

Tracks #303.

`/bdk:plan` leaves the plan uncommitted for the user to review, and a failed `bdk plan check` lists problems by kind (`overlap`, `cycle`, `shared-not-alone`, ...). The user docs explain what a plan is for (`docs/concepts/stages.md`), its flow (`docs/concepts/orchestrators.md`) and the part limits (`docs/guide/configuration.md`, `docs/concepts/gates-and-budgets.md`), but not what a part, a wave, `depends-on` and `isolation` mean, how waves are computed, or what each problem of the check means and how to fix it. A user reviewing a plan or reading a failed check has nothing to go on.

## What Changes

- The plan slice of the `bdk` CLI gains, next to its list of checks, one text per problem kind: what it means and what to do. A check without its text does not compile (resolves "To resolve in the spec": where the text lives; design D1).
- The Reference generator reads that text and renders a "Problems" table under `bdk plan check` in `docs/reference/bdk/cli.md` (resolves "To resolve in the spec": a section of the CLI page, not a new page; design D2). A test of the generator fails when a problem kind has no row.
- `docs/concepts/stages.md` gains a section "How a plan is cut": parts, waves as longest-path layers of `depends-on`, `isolation` (`worktree`, `shared`), the fewest-waves aim, how to read a part file when reviewing a plan, and a link to the problem list. `docs/guide/workflow.md` links to it where the plan stage is described.
- The output of `bdk plan check` does not change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: the Reference lists every problem kind of `bdk plan check` with what to do, and the Concepts explain how a plan is cut, linked from the Guide.

## Impact

- Code: `plugins/bdk/src/plan/domain/check.ts` (the problem texts), `scripts/docs-reference/{model,render}.ts` and their tests.
- User docs: `docs/concepts/stages.md` (new section), `docs/guide/workflow.md` (link), `docs/reference/bdk/cli.md` (generated).
- Not in scope: copying the planner's cutting rules from `plugins/bdk/skills/plan-draft/SKILL.md` into the docs; changing the text or JSON output of `bdk plan check`.
