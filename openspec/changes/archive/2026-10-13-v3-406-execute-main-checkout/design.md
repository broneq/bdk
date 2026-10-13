# Design

## Context

`execute-waves` today runs the parts of a wave in parallel batches of `execution.max-parallel`, each part that shares its wave in a worktree `<run dir>/worktrees/<id>` on a branch `bdk/<change>/part-<id>`, then merges the branches in part order (`resolve-conflict` on a conflict), then runs the wave check (`resolve-conflict --wave` on a red one). A part alone in its wave already runs in the main checkout (archived Change of #344). The incident of #406 showed that a worktree lacks the project's environment, so its checks fail or lie, and that heavy checks cannot share one machine anyway.

## Goals / Non-Goals

**Goals:** every part runs in the main checkout, one at a time, in plan order, committed when green; no worktree, part branch or merge is ever made; no plan key, check, setting or block is left that exists only for parallel writes.

**Non-Goals:** parallel read-only work (reviewers, verifiers, several pull requests in `/bdk:pr-review`) stays as it is. How a check command runs and what the transcript shows of it is #408.

## Decisions

### D1. One part at a time, in the main checkout

The lead takes the waves of `bdk plan check --json` and runs their parts in order: wave 1 before wave 2, ascending part id within a wave. For each part: implementer, then conformer, then commit on the Change branch, then the next part. A retry or an escalation reruns the same part before the next one starts. A blocked part stops the stage at once: its uncommitted work stays in the main checkout, where the next run continues from it (D7), and a later part started on top of it would commit that half-done work with its own (`git add -A`). Today the other parts of the blocked part's wave still ran, because they ran beside it; in sequence they wait for the next run.

- *Parallel parts in worktrees (today):* lost on the incident's grounds: a worktree is not the project.
- *Parallel parts in one checkout:* two agents editing one tree, each part check seeing the other's half-done files; no isolation at all.
- *One agent for the whole plan:* loses the part as the unit of retry, escalation and review grouping (`bdk git groups --plan` groups by part).

Within a wave, the parts are independent, so part order there is only a stable convention. Part `02` sees the committed work of part `01`; its checks run on its own changes (`--changed HEAD`), so the commit after each part is what keeps each part's diff its own.

### D2. A wave is an order and the place of the wave check

Waves stay the longest-path layers of `depends-on`. They carry no parallelism any more; they decide the order and where the `wave` check point runs: once per wave, on the files changed since the wave's base (`waves.<n>.base` in `state.json`, unchanged). A part check (`--at part --changed HEAD`) runs only the items on the part's own changed files, so a part can break an earlier part's test that it never runs (part `02` changes `balance()`, part `01`'s test of `summary()` breaks). The wave check finds it.

- *Drop waves, run one check at the end:* a break found after the last part is far from its cause, and later parts build on it.
- *Run the `wave` point after every part:* the whole suite once per part; the cost #406 complains about.

`plan-draft` keeps aiming at the fewest waves the dependencies allow: fewer waves, fewer whole-suite runs. It no longer keeps the parts of a wave on disjoint files: two parts in sequence may change one file.

### D3. The wave repair becomes its own block, `repair-wave`

A red wave check is repaired by `/bdk:repair-wave <change> <n> --base <commit> [--run-dir <path>] [--parts <dir>]` on `bdk:implementer`, the text of today's "Wave repair" section of `resolve-conflict` (W1 to W5) with the same report `execute/wave-<n>.md` and the same limits (only the `files` of the wave's parts, no git history, three check runs, `Kind: conflict | other`). The lead runs it once, then once more on `policy.escalation.model`, commits a `Status: done`, and blocks the wave otherwise, as today.

The user chose this over two alternatives (2026-10-13, review page of the decision):

- *No repair, a red wave check blocks:* fewest blocks, but `/bdk:run` stops on every red wave and the user fixes code by hand, outside test-first and conform.
- *Keep `resolve-conflict` with only `--wave`:* least change, but "conflict" and `--wave` name a merge mode that no longer exists; one block, one job (CLAUDE.md, "Building skills").

`resolve-conflict` is removed whole: its merge mode had one caller, step 6 of `execute-waves`, which goes. Its report `execute/merge-<id>.md` and check id `merge-<id>` go with it.

### D4. `isolation` is an error, not ignored

`bdk plan check` ignores unknown frontmatter keys. A part that still says `isolation: worktree` would pass silently and keep telling its reader that it runs in a worktree, so the key gets a `frontmatter` fault of its own: `isolation is no longer a part key: parts run one after another in the main checkout; remove it`. The plan of a Change written by an earlier BDK fails the check once, with that fix in the message; `execute-waves` already stops on a part without a wave, which a `frontmatter` problem gives.

The checks `overlap` and `shared-not-alone` are removed, not kept as warnings: `overlap` warned of a merge conflict that cannot happen, and `shared` no longer exists. The `--json` result loses `parts[].isolation`; the text line of a part loses its isolation column.

### D5. `--workdir` goes from `implement-part` and `conform-part`

Only the execute lead passed it, for a worktree. Keeping a flag without a caller keeps its rules (absolute paths, `git -C`, `cd <workdir> &&`) in both skills for nothing. `/bdk:pr-review`'s `--workdir` for the review blocks is a different flag of different skills and stays.

### D6. `execution.max-parallel` stays, described for read-only work

`review-round`, `pr-review-round` and `pr-review` read it; `execute-waves` no longer does. Its description becomes "the most read-only agents a lead starts at once (reviewers; pull requests of `/bdk:pr-review`)". `policy.budgets.part-attempts` and `policy.escalation.*` serve retries of sequential parts too. No other key exists only for parallel writes.

### D7. Resume without worktrees

`state.json` keeps its schema (spec `bdk-cli/run`). A part not `done` with recorded attempts may have left uncommitted work in the main checkout; the lead keeps it when every changed path is in that part's `files`, as today for a part alone in its wave. A run directory from an earlier BDK that still holds `worktrees/` or a branch `bdk/<change>/part-*` is not read: the lead never looks for them. This is the migration cost of the breaking change, named in the commit's `BREAKING CHANGE:`.

## Risks / Trade-offs

- [A plan with many independent parts takes longer in wall-clock time] → the parts that ran in parallel were the ones the incident showed failing; the review stage, where most of the time goes, stays parallel.
- [Later parts build on an earlier part's mistakes] → each part is conformed and committed green before the next starts, and the wave check runs the whole suite once per wave.
- [Plans written by an earlier BDK fail `bdk plan check`] → one `frontmatter` problem per part, whose message says to remove the key; `/bdk:plan <change>` rewrites the plan.

## Measurement

The acceptance case `execute-main-checkout` and the changed `execute-*` and `repair-wave-dated` cases are written in this Change; the issue names no `Budget`, so no paid run is made here and none is recorded (spec `skill-evals`, "Paid measurement discipline"). Total cost of paid runs in this Change: $0, none run.
