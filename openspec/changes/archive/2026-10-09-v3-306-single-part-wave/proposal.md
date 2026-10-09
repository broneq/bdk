# Proposal

## Why

Tracks #306.

`execute-waves` gives every `isolation: worktree` part its own git worktree and merges it back with a merge commit. Isolation protects parts of one wave that run at the same time; a wave with a single part to run has nothing to protect, yet pays for a checkout, cold tool caches, dependencies the worktree does not have (a project `.venv`, a Rust `target/`), and a merge commit. A `shared` part already runs in the main checkout, so the mechanism exists.

## What Changes

- The execute lead runs a part in the main checkout, as it runs a `shared` part, when the part is the only part not `done` of its wave: no `--workdir`, committed on the Change branch, nothing to merge. The part file's `isolation` stays as written.
- A part whose worktree directory or branch `bdk/<change>/part-<id>` exists from an earlier run keeps running in that worktree, so no earlier work is lost.
- A part that ran in the main checkout and did not finish leaves its work uncommitted there. On the next run the lead accepts that tree instead of stopping on "uncommitted changes" when every changed path lies in the files of the part it runs next in the main checkout and the state records an earlier attempt of that part; the implementer continues from the files as they are.
- New eval cases of the execute lead: a plan with waves `1: 01 02` and `2: 03`; a resumed part `03` with its worktree left by a break; a resumed part `03` with its work left in the main checkout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-execute`: "Branch and worktrees" (where a part runs; the leftover work of a main-checkout part on resume) and "Commits and merge-back" (a main-checkout part is committed on the Change branch and not merged).

## Out of scope

- A settings key to turn the rule off: isolation of a lone part protects nothing, so no team needs it (design.md D4).
- Installing dependencies in a worktree for the parts that still run in one: a separate concern, not raised by any run yet.

## Impact

- `plugins/bdk/skills/execute-waves/SKILL.md` (steps 3, 4, 5, 6 and the result), `plugins/bdk/skills/execute/SKILL.md` description if it names worktrees per part.
- `plugins/bdk/evals/`: new cases `execute-single-part-wave`, `execute-resume-worktree`, `execute-resume-main-checkout`, a shared fixture for the three-part plan, `evals/README.md`.
- User docs: `docs/concepts/orchestrators.md` (the execute-waves diagram, "a work directory per part"), `docs/concepts/stages.md` ("How a plan is cut", `isolation`), `docs/concepts/run-state.md` (`worktrees/NN/`), `docs/guide/workflow.md` (execute paragraph); Reference regenerated with `pnpm docs:reference`.
