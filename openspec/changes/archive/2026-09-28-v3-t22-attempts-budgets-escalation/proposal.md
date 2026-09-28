# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T22. Tracks #54.

T21 gave the Change a graph, but nothing yet bounds the loops that run inside it or records the work that `execute` does: `attempt`, `part`, `commit`, `rebuild`, `change takeover` and `change checkpoint` answer `kernel/not-implemented`, `change park` reports its checkpoint as skipped, `change status` ships empty `parts`, and pipeline nodes carry a `budget` name whose value nobody reads. Without them a retry loop is a prose cap again (S2 fails), a killed session loses its progress (S5 fails) and a plan part can grow past 8 KB unnoticed (S1 fails). T23 (dispatch, evidence), T24 (`session-end` checkpoint, `pre-tool` guard) and T41 (`/bdk:execute`) all run under tickets and trailers, so this task comes first.

## What Changes

- **`attempt` slice**: `attempt open <loop> <target> [--escalate]` issues a ticket or refuses with the next rung of the ladder; `attempt close <ticket> ok|fail|not-run` records the outcome, stores finding fingerprints, runs the diff check and the envelope entry check, and returns the next action; `attempt list` reads the committed records and the budgets. One committed record per ticket under `attempts/`.
- **Loop protection (A-drabina)** as kernel rules, not prose: budgets per loop from policy, `not-run` with its own consecutive budget that never consumes the loop budget (P4), finding fingerprints and oscillation detection, scope narrowing `full -> high+ -> blockers` with dropped findings surfaced as one kernel `finding` for the human, a one-shot escalation ticket (`--escalate`, stronger model from policy, switchable off, capped per Change), and at the end of the ladder one `question` entry with `park: true` and options, so the Change is parked with a single resume command. An answer (`change resume --option <n>`) opens a new round; budgets are never reset silently.
- **`part` slice**: `part list | start | done | split`. Part state derived from the graph, the start marker and git trailers, never stored. The plan part validators (S1, P6, P7) plug into the `plan-part` kind that `validate` and `done` already run: <= 8 KB, 1-8 tasks, the task grammar, `do-not-touch` intersecting `Files:`, placeholders in executable fields, `depends-on`, and `spec-impact` naming existing `spec-delta/` files.
- **Task grammar** of a plan part body, taken from today's `create-plan` template: `## <task-id> <title>` headings with `**Files:**`, `**Test cases:**` or `**Verification:** none`, optional `**Depends on:**` and `**Stop rule:**`.
- **`commit <task>`**: pathspec commit of the task's files and the Change directory with the trailers `BDK-Change`, `BDK-Part`, `BDK-Task`; the diff check shared with `attempt close` refuses a `do-not-touch` path and records an undeclared file as a `finding`.
- **`log ingest --ticket`** (T2): a fenced `bdk-entries` YAML block validated entry by entry like `log add`, provenance from the ticket's role, the whole block refused with `input/invalid-block` naming the line; `attempt close --envelope` refuses envelope entry ids that do not exist under the ticket.
- **`rebuild`**: drops and rebuilds the index, runs the T14 migrations, regenerates `plan/index.md` and `design/index.md`, reads progress from trailers and attempts from the committed records, and reports `state/trailer-mismatch` with both sides.
- **`change checkpoint`**: `git commit --only -- .bdk/changes/<id>/` as `chore(bdk): checkpoint <change>`, skipped during rebase, merge or cherry-pick, with open tickets or when `policy.checkpoint.enabled` is false; `change park` and `attempt open --escalate` call it.
- **`change takeover [--close-tickets]`**: closes a dead session's open tickets as `not-run`, records the takeover and rebuilds.
- **`change status`** fills `parts`; **tiny guard**: `commit` and `part done` of a `tiny` Change measure the Change's commits and write a `finding` with `review: true` over 2 files, 1 module or 50 lines.
- **Registered settings**: `policy.budgets.*`, `policy.oscillation.threshold`, `policy.escalation.*` (consumer `attempt`) and `policy.checkpoint.enabled` (consumer `change`) join the `policy` root through per-subtree modules.
- **Engine amendment**: a kernel `transition` marks a node done only when it carries `input-hash`, so the `part start` marker and T24's stage transitions never make a node look done or stale; `execute-part` hashes its plan part file.
- **Contract amendments** (spec deltas plus `schema/` in the same PR): the escalation becomes the `--escalate` flag instead of a `task-escalation` loop (**BREAKING** for the unshipped contract only); `attempt open` gains `escalation`; `attempt close` gains the question entry in `next`; `attempt close` joins the writers of `question` with `park: true` and `finding`; `part split` joins the writers of `decision`; `rebuild` and `change takeover` write through `shared/store`; `part-list` and `change-status` drop the 8 192 cap on `bytes` so an oversized part can still be listed; the dependency matrix gains `commit -> measure` and `part -> measure`; a new refusal `policy/git-hook-failed` for `commit` and `change checkpoint`; `attempt open` gains `policy/invalid-transition` (an `--escalate` the ladder does not allow) and `part start` `policy/validation-failed` (a failing part check without a rule of its own).

Resolutions of the plan's "To resolve in the spec" (details and rejected alternatives in design.md):

- **Escalation model and cost limit per Change**: the model is `policy.escalation.model` (default `opus`), returned by `attempt open --escalate`, never an argument; the kernel sees no token counts, so the cost limit is a count: new key `policy.escalation.per-change` (default 3) caps escalation tickets per Change, after which the ladder skips the escalation rung.
- **Normalisation of "problem" in the fingerprint**: `normalise` of `kernel-state`, Fingerprints (T14), applied to the entry's `summary`; `file` and `symbol` come from the entry's first file ref (`path` or `path#symbol`). A fingerprint that appears in `policy.oscillation.threshold` (default 2) `fail` records of one loop and target in the current round is oscillation.
- **Default budget values**: the `kernel-settings` table stands: `task-redispatch` 3, `verify-fix` 2, `review-fix` 2, `verifier` 2, `not-run` 3, oscillation threshold 2, escalation on.
- **Squashing checkpoints at `close`**: default off (keep them as history: a squash rewrites commits the user may have pushed); `policy.checkpoint.squash-at-close` moves to T30, which implements `change close --squash` and is its only consumer.
- **Plan part file format**: the T14 frontmatter plus the task grammar above, a subset of today's `create-plan` template, so T41's `/bdk:plan` template stays close to v2.
- **Whether `takeover` stays a separate command**: yes. `resume` binds a branch or leaves the parked state and writes no attempt; `takeover` closes another session's tickets. Merging them would make a routine `resume` able to close tickets.

Inputs carried by citation: design "Loop protection (A-drabina)", "Attempt durability (V1-4)", "Plan part fields and plan-quality rules (P6, P7)", "Key boundaries" (IDs and concurrency, working tree guard, agent write channel), risks "Oscillation detection false positives" and "Checkpoint commits add noise (V1-4)"; decision register A-drabina, V-checkpoint, P4, P6, P7, S1, S2, S5, Q3, T2; T14 state spec (`kernel-state`: Attempt record, Fingerprints, Identifiers, Plan part and plan index, Write map, Schema versions and migrations); T20 design D-11 (tiny guard) and D-14 (checkpoint placeholder); T21 "Fixed by T21" (loop names on nodes, `execute-part` through `part done`, part validators in the `plan-part` kind); `scripts/bdk_run_state.py` as a seed (manifest-as-cache, trailers-as-truth, Refusal, `deferred_findings`, `reconcile`).

Out of scope:

- Dispatch packages, `dispatch build` and the placeholder refusal there, evidence freshness (`policy/stale-evidence`) and citations (`policy/missing-citation`) at `attempt close`, the P8 downgrade of uncategorised blockers and the `observation` cap in `log ingest` (T23). T22 tests use a hand-written dispatch package fixture where a ticket needs a role.
- `hooks session-end` calling the checkpoint, the `pre-tool` guard denying `bdk.mjs commit|attempt|part` to subagents, session ids on tickets (T24).
- `change close --squash` and `policy.checkpoint.squash-at-close` (T30); spec delta content validation (T30).
- `/bdk:plan`, `/bdk:execute` and the rest of the stage skills that drive these commands (T41); `rules/plan.md` with the `PL` rules (T41 content, checked by the plan verifier).

## Capabilities

### New Capabilities

- `kernel-loops`: the loop model shared by `attempt`, `part`, `commit` and `change`: loops and targets, budgets and rounds, `not-run`, finding fingerprints and oscillation, scope narrowing, escalation, the end of the ladder, the diff check against `Files:` and `do-not-touch`, and progress from trailers.

### Modified Capabilities

- `kernel-cli`: the rule catalogue gains `policy/git-hook-failed` and the new emitters of `policy/invalid-transition` and `policy/validation-failed`; the `policy/oscillation` meaning follows the threshold.
- `kernel-cli/attempt`: `attempt open`, `close`, `list` with their T22 behaviour, the `--escalate` flag and acceptance scenarios.
- `kernel-cli/part`: `part list`, `start`, `done`, `split` with the validators, state derivation and the tiny guard.
- `kernel-cli/commit`: `commit` with staging, trailers, the diff check and the tiny guard.
- `kernel-cli/log`: `log ingest` with the block format, line numbers and the ticket counter.
- `kernel-cli/change`: `change takeover`, `change checkpoint`, `change park` running the checkpoint, `change status` filling `parts`.
- `kernel-cli/service`: `rebuild` with its steps and the trailer mismatch.
- `kernel-cli/graph`: `validate` and `done` run the part validators; `done` still refuses `execute-part`.
- `kernel-pipeline`: a done marker needs `input-hash`; `execute-part` hashes its part file and validates trailers and tickets.
- `kernel-state`: task grammar of the plan part body; attempt record loops without `task-escalation`; question `park` and `finding` writers; progress from trailers; write map rows for `part split`, `attempt close`, `rebuild`, `change takeover`.
- `kernel-settings`: the `policy` root split into per-subtree modules; `policy.budgets.*`, `policy.oscillation.threshold`, `policy.escalation.*` with the new `per-change`, `policy.checkpoint.enabled` registered; `squash-at-close` moves to T30.
- `kernel-architecture`: `commit -> measure` and `part -> measure` in the dependency matrix; `service` writes only through `shared/store` for `rebuild`.

## Impact

- New code: `kernel/src/attempt/`, `kernel/src/part/`, `kernel/src/commit/` slices (commands, use-cases, domain, render, schema, `config.ts` for `attempt`, tests); `shared/store` modules for the plan task grammar, trailer progress, the rebuild core and the checkpoint core; `shared/git` trailers, pathspec commit and working-tree diff.
- Changed code: `graph` (engine done-marker rule, `plan-part` and `execute-part` validators, `ChangeView` gains trailer and ticket facts), `log` (`ingest`), `change` (`takeover`, `checkpoint`, `park`, `status`, `config.ts` for `policy.checkpoint`), `service` (`rebuild`), `shared/config` (nested module keys, planned keys), `registrations.ts`, `kernel/scripts/export-schemas.ts`.
- Contract: `schema/cli/commands.json` (argv of `attempt open`, rules), `schema/cli/output/{attempt-open,attempt-close,attempt-list,part-list,part-start,part-done,part-split,commit,log-ingest,rebuild,change-takeover,change-checkpoint,change-park,change-status}.json`, `schema/state/attempt.json`, `schema/settings` JSON Schema, the state fixture.
- Docs: `docs/guide/` pages for the execute loop, parts, commits, checkpoint and the `policy` keys; `docs/V3-IMPLEMENTATION-PLAN.md` points T22's open items to this Change and notes the hand-offs to T23, T24, T30, T41.
- Bundle `dist/bdk.mjs` rebuilt. No new runtime dependency (`yaml` is already bundled).
