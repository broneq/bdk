# Design

## Context

See proposal.md - Why. The state this Change builds on:

- T10 registered every T22 command in `schema/cli/commands.json` with its rules and an output schema; they answer `kernel/not-implemented`. The `kernel-cli/attempt`, `part`, `commit`, `log` (`ingest`), `change` (`takeover`, `checkpoint`) and `service` (`rebuild`) specs hold their T10 text.
- T14 fixed the documents: the attempt record (one file per ticket, `attempts/<loop>-<target>-<ticket>.md`), merge-safe random ids (`A-` + 8 characters), the fingerprint function (`normalise`, `findingFingerprint`), the plan part frontmatter and the generated plan index, the write map, schema versions and `migrateDocument`.
- T20 shipped the ledger writer (`appendEntry`, dedupe), the index with an `attempts` table and `openAttempts`, `ticketRole` (role from a ticket's dispatch package), `change park` (question with `park: true`, checkpoint reported as skipped) and `measure`.
- T21 shipped the engine (`graph/domain/engine.ts`): a kernel `transition` whose `to` names a node is that node's done marker, `done` when its `input-hash` equals the current one, `stale` otherwise, even without a hash. `execute-part` has no inputs and no checks and is done only through `part done`; pipeline nodes name their loop in `budget`; the `policy` config module is registered by `graph` with `gates` only.
- `scripts/bdk_run_state.py` is the v2 seed: a manifest as cache, `BDK-Run` / `BDK-Group` trailers as truth, `reconcile` on every read, `rebuild` from trailers, `deferred_findings` keyed by `(severity, category, file, symbol|line, problem)`.

Constraints: the dependency matrix (`kernel-architecture`) allows `attempt -> part, log, evidence`, `commit -> part, log`, `part -> graph, log`, `change -> measure, graph, log, spec, rules`, `service -> every slice read-only`; reads of committed state go through `shared/store` queries, not slice imports. S1 caps a CLI state answer at 100 lines. Main-thread git belongs to the user (T3): no command may sweep in files the user staged.

## Goals / Non-Goals

**Goals:**

- Every loop's count, budget and next rung is derivable from committed attempt records and the ledger on any clone; nothing about a loop lives in `.machine/`.
- The ladder always terminates in a named state (`kernel-loops`): a ticket, an escalation, or a parked Change with options.
- Progress survives a killed session: trailers plus committed records plus `rebuild` reconstruct it.
- One diff check, used by `attempt close` and `commit`, reading git, never the envelope's file list.

**Non-Goals:**

- Deciding what a worker does with a narrowed scope or a stop rule (role contracts, T23 and T41).
- Measuring token cost of an escalation; the kernel has no token data.
- Team workflows on one Change (part takeover, ledger conflict validator, design "What we did NOT decide").

## Decisions

### D-1 Loops, targets and rounds

A loop is one of `task-redispatch` (target: a task id), `verify-fix` (a part id), `review-fix` (the Change id), `verifier` (an artifact id such as `plan-verify` or `design`). `not-run` is not a loop: it is a counter per loop and target with its own budget. Loop and target form the key of every count.

A **round** is the sequence of records of one key that no answered ladder question names: the ladder question's `refs` name the target and every ticket of the round it ends, and a `decision` entry whose `refs` name the question answers it. Timestamps have a resolution of one second, so a close, the answer and the next open can share one; naming the tickets keeps the rounds apart without comparing times. `attempt` (the number) counts the `ok` and `fail` records of the round that are not escalations, plus one; `of` is `policy.budgets.<loop>`; the `not-run` counter counts `not-run` records since the last `ok` or `fail` of the round (consecutive, S2). The first round starts at the Change's start. Answering the question is the only way to get a fresh budget, and it is a recorded `decision` (`change resume --option <n>`), so budgets never reset silently (V1-4).

Alternatives: a `budget-reset` command (a second path to the same effect, and one more command the orchestrator could call on its own); counting attempts over the whole Change without rounds (a user answer "retry" would be refused forever); storing counters in the record (T14 already says counters are derived, never stored).

### D-2 Escalation is a flag, capped per Change

`attempt open <loop> <target> --escalate` opens the one-shot escalation ticket of the round (`escalation: true` in the record). It is allowed only when the round's budget is used up or oscillation was detected, `policy.escalation.enabled` is true, the round has no escalation ticket yet, and the Change has fewer than `policy.escalation.per-change` (default 3) escalation tickets in total. The output carries `escalation.model` from `policy.escalation.model`; the escalation ticket does not count against `of`; its scope is the round's current narrowest scope. Before issuing it the kernel runs the checkpoint (V-checkpoint: "przy park/eskalacji").

The cost limit is a count because the kernel never sees tokens or prices; a count is observable, testable and still bounds the most expensive rung. The model stays a policy value, never an argument (`kernel-cli`, "Clock and budgets are not arguments").

Alternatives: the T10 `task-escalation` loop name (escalation applies to every loop, not only tasks, and a separate loop key would split the round's history across two keys, so the ladder could not see that the escalation of `02-3` belongs to `task-redispatch 02-3`); a token budget (no data source); no cap (one Change with many parts could escalate every task).

### D-3 The last two rungs are one entry

The ladder is narrowed attempt -> escalation -> question at the gate -> parked (A-drabina). The kernel writes one `question` entry with `park: true`, `review: true`, the options and `source: kernel` when the ladder ends, from `attempt close` (the close that exhausts the round with no escalation left, the failed escalation ticket, or the `not-run` close that exhausts the `not-run` budget) and runs the checkpoint. That entry is at once the question shown at the gate (`next`, `change status` pending review entries) and the parked state with its single resume command. `next.action` is `parked` with the entry id and the resume command. Default options: `retry <target> with a fresh budget`, `accept <target> as debt`, and for a task or part target `split part <nn>`.

The difference between "question" and "parked" in the design is whether the user answers now or later; the kernel cannot see whether a user is present, so a separate unparked question would need the orchestrator to decide when to park, which is the prose cap S2 removes. Parking immediately costs nothing when the user answers at once: the answer is `change resume --option <n>`, which the orchestrator relays.

Alternatives: `attempt close` writes an unparked `question` and the orchestrator calls `change park` later (two entries for one decision point, and a run that ends without calling `park` leaves the Change looking active); refusing at `attempt open` without any entry (the refusal is not a state; the acceptance signal requires a `question` entry).

### D-4 Fingerprints and oscillation

A `fail` close stores the fingerprints of the `finding` and `blocker` entries written under its ticket (`log add --ticket`, `log ingest --ticket`): `findingFingerprint(type, file, symbol, summary)` of `kernel-state`, Fingerprints, where `file` and `symbol` come from the entry's first ref of the form `<path>` or `<path>#<symbol>` (a ref that is not an entry, ticket, task, part or rule id). An entry without such a ref has no location and is not fingerprinted. The normalisation is T14's (`normalise`: NFKC, lowercase, digit runs to `#`, other runs to one space, trimmed) applied to the summary, which is the entry's "problem".

A fingerprint oscillates when it appears in `policy.oscillation.threshold` (default 2) `fail` records of the round. With 2, a finding that survives one fix attempt is oscillation: fixing it again with a narrower scope is what does not work. Counting over all `fail` records of the round, not only consecutive ones, catches both `A, A` and `A, B, A`. Oscillation shortens the ladder: `attempt close` returns `escalate` (or `parked` when no escalation is left) regardless of the remaining budget, and a plain `attempt open` of that round refuses with `policy/oscillation`.

Alternatives: consecutive records only (misses `A, B, A`); the v2 `deferred_findings` key with severity and category (a reviewer re-grading the same problem from high to medium would hide the loop); fingerprinting the body (bodies carry line numbers and prose that change every round).

### D-5 Scope narrowing and dropped findings

Attempt 1 of a round runs `full`, attempt 2 `high+`, attempt 3 and later `blockers`; the escalation ticket keeps the last scope. `high+` keeps `blocker` entries and `finding` entries of severity `critical` or `high`; `blockers` keeps `blocker` entries and `critical` findings. At `attempt open` the kernel takes the open findings of the previous `fail` record of the round (entries with `status: proposed` under that ticket), and those outside the new scope are dropped: listed in the record's `dropped` and in the output, and summarised in one kernel `finding` entry with `review: true` whose `refs` are the target and the dropped ids, so the human sees them at the gate (design "Scope N+1 is a subset of scope N; what drops out becomes a `finding` entry for the human"). One entry per open keeps the ledger short and dedupes by summary and refs.

Alternatives: re-flagging each dropped entry with `review: true` (an in-place mutation T14 does not allow); writing one entry per dropped finding (duplicates the originals).

### D-6 `policy` split into per-subtree modules

`createConfigRegistry` accepts a module whose `key` is a dotted path (`policy.gates`, `policy.budgets`, `policy.oscillation`, `policy.escalation`, `policy.checkpoint`) and composes the modules sharing a root into one strict object; a module key that is a prefix of another is a startup error, like a duplicate root today. `graph` keeps `policy.gates`; `attempt/config.ts` registers budgets, oscillation and escalation; `shared/store/config.ts` registers `policy.checkpoint.enabled`, because the checkpoint core in `shared/store` (D-11) is what reads it for all four callers, and `attempt` cannot reach a module of `change`. The consumer column of `kernel-settings` stays true, and the structural test "a consumer with handlers reads its module" still applies per module. `policy.checkpoint.squash-at-close` stays a planned key, now owned by T30 and consumed through the same module; the planned-key lookup already works on dotted paths, and a test covers a planned key inside a registered subtree.

Alternatives: `graph` owns all of `policy` and other slices read it through `graph/index.ts` (the consumer column would lie, and `attempt -> graph` is not in the matrix); a new root such as `loops.*` (renames keys the `kernel-settings` table and the design already publish).

### D-7 Plan part body: the task grammar in `shared/store`

The body of a plan part holds tasks as `## <task-id> <title>` headings, `<task-id>` = `<nn>-<k>` (two digits, a dash, a positive integer). Under a heading the kernel reads bold field labels `**Files:**`, `**Test cases:**`, `**Verification:**`, `**Depends on:**`, `**Stop rule:**`; any other text (implementation notes, `**See:**`, scaffolds) is free. `Files:` is a list of items each holding one backticked relative path, optionally prefixed by `Create:`, `Modify:`, `Test:` or `Delete:` (today's template). A task has `Test cases:` (a non-empty list) or `Verification: none` (`.claude/rules/verification-scoping.md`). `Depends on:` names task ids of the same part or `none`. Task ids are unique across the plan, not necessarily prefixed by their part (a task keeps its id when `part split` moves it, D-12). The parser lives in `shared/store/state/plan.ts` next to the frontmatter schema, because the `plan-part` kind (graph), the diff check (part, used by attempt and commit) and `rebuild` all read it.

Placeholders: an executable field is `goal`, `success-measure`, a task title, each `Files:` item, each `Test cases:` item and `Stop rule:`; it holds a placeholder when it contains `TODO`, `TBD` or `FIXME` as a word, `<fill in>`, `[...]`, or is `...` or `…` alone. Bracketed template prompts like `[Action verb + what]` are caught by a leading `[` and trailing `]` on a title or item.

Alternatives: a YAML task list in the frontmatter (the plan becomes unreadable as prose and the v2 template, which T41 adapts, is Markdown); task ids prefixed by their part as a rule (a split would rename tasks and reset their attempt history, which D-1 forbids).

### D-8 Part state, the start marker and the done marker

`part start <nn>` writes a `transition` with `to: execute-part:<nn>`, `source: kernel` and no `input-hash`; `part done <nn>` writes the same `to` with the `input-hash` of the part file. The engine counts only kernel transitions carrying `input-hash` as done markers (amending `kernel-pipeline`, Node states), so the start marker neither marks the node done nor stale, and neither do T24's stage transitions from `hooks prompt-expansion` with `source: kernel`. `execute-part` inputs become its plan part file: editing a part after `part done` makes the execution stale, and `part split` of a started part changes the hash as it should. Part state for `part list` and `change status`: the node state, with `ready` shown as `started` when a start marker exists after the latest done marker. `change status` takes its `parts` from the part slice's `partItems` over the graph it has already read (new matrix edge `change -> part`), so the two commands cannot drift. The stage derivation (T21 D-12) maps `execute-part:<nn>` to `execute`, so the first `part start` moves the stage.

Alternatives: a new transition field such as `phase: start` (a state schema version bump for a fact the missing hash already expresses); `part start` writing `to: execute` (overloads the stage id, which is also the collection node's id); no start marker, deriving `started` from the first ticket (a part could not be started before its first dispatch, and `part start` would validate nothing durable).

### D-9 The diff check

`diffCheck(target)` (exported by `part/index.ts`) reads the working tree: `git status --porcelain=v1 -z --untracked-files=all`, keeping the paths whose working-tree column is set (a path whose whole change is staged is the user's, T3, and stays out of both the check and `commit`), excluding `.bdk/`, and `.gitignore` while its only difference from `HEAD` is the ignored-path lines `change new` appends (otherwise the kernel's own edit would be reported as undeclared work on every close). For a task target, the declared set is the task's `Files:` and the forbidden set is its part's `do-not-touch`; for a part target, the union of its tasks' `Files:` and its `do-not-touch`; for the Change target (`review-fix`), no declared set and the union of every started part's `do-not-touch`; for a `verifier` target, no check. A touched path matching a forbidden glob refuses with `policy/do-not-touch` naming the path and the glob. A touched path outside the declared set that no other task of a started part declares and that has no trailer commit yet is `undeclared`; with parallel tasks in one wave, a path declared by a sibling is the sibling's, so one task's check never flags another's work. `attempt close` and `commit` write one kernel `finding` per call listing the undeclared paths (`refs`: the task and the paths), deduped by the ledger.

Alternatives: a snapshot of the tree at `attempt open` (a `.machine/` file that a killed session loses, and parallel tasks would still share the tree); trusting the envelope's `files` (P6, rule A2 "no self-grading": the kernel reads the diff).

### D-10 `commit` mechanics

`commit <task>` refuses during a rebase, merge or cherry-pick, while a ticket of the task is open, and on a forbidden path; it then stages with `git add -A -- <paths>` the task's touched declared paths, its undeclared paths (D-9) and `.bdk/changes/<id>/`, and commits with `git commit --only -F <message> -- <paths>`, so files the user staged elsewhere stay staged and uncommitted. The message is the subject (`--message` or the task title) and a trailer block `BDK-Change`, `BDK-Part`, `BDK-Task` (written into the message, not through `--trailer`, which needs git 2.32). The user's git hooks run; a failing hook is the new refusal `policy/git-hook-failed` (exit 2, `why` carrying the hook's first output line), and nothing is left half-committed because `--only` commits atomically. Progress is then read back from the trailers (`git log --fixed-strings --grep "BDK-Change: <id>" --format=<hash, trailers>`), the read-back after write TSH confirmed.

Alternatives: `--no-verify` (bypasses the user's policy silently); `git commit -a` (sweeps unrelated work).

### D-11 Checkpoint core in `shared/store`

The checkpoint is `checkpointChange(change)` in `shared/store` (composing `shared/git`), because four callers in three slices need it: `change checkpoint` and `change park` (change), `attempt open --escalate` and the ladder end in `attempt close` (attempt), `hooks session-end` (T24). It returns `{done: true, commit}` or `{done: false, skipped: <reason>}`: `policy.checkpoint.enabled` false, nothing changed under the Change directory, a rebase, merge or cherry-pick in progress, an open ticket, or a failing git hook. Only the explicit `change checkpoint` turns the in-progress, open-ticket and hook cases into refusals (`policy/git-in-progress`, `policy/ticket-open`, `policy/git-hook-failed`); the implicit callers never fail because of a skipped checkpoint (V1-4: the next task commit carries the files). Commit: `git add -A -- .bdk/changes/<id>/` then `git commit --only -m "chore(bdk): checkpoint <id>" -- .bdk/changes/<id>/`.

Alternatives: `attempt -> change` in the matrix (a new slice edge for one function, and `hooks` would still reach it through `change`); callers shelling out to `bdk change checkpoint` (a process per call and a second refusal path).

### D-12 `rebuild`, trailer mismatch and `part split`

The rebuild core is `rebuildChanges(changes)` in `shared/store`: delete and rebuild the index for the Changes, run `migrateDocument` on every committed document whose `schema` is older, regenerate `plan/index.md` and `design/index.md`, read the trailer commits, and check them. `service` composes it for `bdk rebuild`; `change takeover` calls it after closing tickets. `bdk rebuild` stays Change-scoped (the contract ties `policy/no-active-change` to Change-scoped records); `--all` widens it to every Change directory, and a fresh clone runs `change resume <id>` first to get its branch marker. `state/trailer-mismatch` is reported when a `BDK-Task` names a task no part holds, when `BDK-Part` differs from the part holding the task, when a `BDK-Change` commit lacks `BDK-Part` or `BDK-Task`, or when an attempt record's task target is in no part; the error names both sides (commit and plan, or record and plan). Budgets and counts are read from the records exactly as `attempt list` reads them, so a rebuilt index gives the same answers.

`part split <nn> <task-ids>` creates part `max + 1` with the moved tasks (ids unchanged, so their attempt history and budgets carry over), a copy of the original frontmatter with `title` suffixed ` (split from <nn>)`, rewrites the original without them, adds the new id to the `depends-on` of every part that depended on the original, regenerates the index and writes a `decision` entry. It refuses to move a task with a trailer commit, to move every task, and a part that is done. The edited parts change their hashes, so `plan-part` instances and `plan-verify` turn `stale` and the plan verifier runs again, with no explicit stale marking.

Alternatives: `rebuild` in `service` reading slices (service would write, which its matrix row forbids); renumbering moved tasks (resets history, D-7).

### D-13 `log ingest` block

Input is a whole report or a bare block; exactly one fenced block whose info string is `bdk-entries` must be present, holding a YAML sequence. Each item takes the fields of `log add` in their document spelling: `type`, `summary`, `refs`, optional `body`, `review`, `supersedes`, `status`, `severity`, `category`, `options`; `id`, `at`, `author`, `source`, `ticket`, `fingerprint` are `input/forbidden-field`. Every item is validated before any is written; the first failure refuses the whole block with `input/invalid-block`, `why` naming the item index, the field and the line in the input (from the YAML node's range, offset by the fence's position). Provenance and ticket come from the ticket (`ticketDispatch`: the role and the dispatch package). The ticket's entry counter is the number of entries carrying that ticket; `attempt close --envelope` compares the envelope's `entries` with it and refuses `policy/entries-missing` naming the ids that do not exist under the ticket.

Alternatives: partial ingestion of the valid items (T2 requires whole-block refusal so a re-dispatch replaces the block instead of patching it); JSON lines (reader roles write YAML more reliably, and T2 names YAML).

### D-14 `takeover` without session liveness

Until T24 stamps session ids, the kernel cannot tell whether the session that opened a ticket is alive. `change takeover` therefore refuses with `policy/invalid-transition` when no ticket is open (nothing to take over, `instead` names `bdk rebuild`), refuses with `policy/ticket-open` listing the tickets without `--close-tickets`, and with it closes each open ticket as `not-run` with reason `taken over`, writes a kernel `transition` to the current stage naming the tickets in `refs`, and runs the rebuild core. `previousSession` stays absent until T24.

Alternatives: keeping the T10 liveness refusal with a heuristic such as a PID file (a `.machine/` fact that does not exist on another machine, where takeover matters most).

### D-15 Tiny guard range

For a `tiny` Change, `commit` (after committing) and `part done` measure the range from the parent of the Change's first `BDK-Change` commit to `HEAD` through the `measure` slice (new matrix edges `commit -> measure`, `part -> measure`). Over 2 files, 1 module or 50 lines they write a kernel `finding` with `review: true` naming the numbers; the ledger dedupe (digits normalised) keeps it to one open entry. The guard never refuses (T20 design D-11: the user decides at the review gate whether to raise the profile).

Alternatives: measuring only the new commit (a tiny Change of ten small commits would pass); refusing the commit (the work is done; blocking it loses it).

### D-16 Record the resolutions in the plan

As T21 did, the T22 section of `docs/V3-IMPLEMENTATION-PLAN.md` points each "To resolve in the spec" item to this Change, and the T23 (placeholder refusal at `dispatch build`, evidence checks at `attempt close`, P8 downgrade and observation cap in `log ingest`), T24 (checkpoint from `session-end`, session ids for `takeover`, `pre-tool` deny list), T30 (`squash-at-close`, default off) and T41 (task grammar for the `/bdk:plan` template, `change resume --option` as the answer to a ladder question) rows note what they inherit.

## Risks / Trade-offs

- [Two `attempt open` calls for the same loop and target race and both write a ticket] -> The orchestrator serialises per target; after writing, `attempt open` re-reads the records and, when another open ticket of the key exists, deletes its own record and refuses `policy/ticket-open`. The window is two file writes.
- [An undeclared path touched by two parallel tasks is claimed by the first `commit`] -> The finding names the path; the reviewer sees it at the gate. Accepted: parallel tasks have disjoint `Files:` by construction of the waves.
- [The user edits undeclared files during `execute`; the next `commit` sweeps them in as undeclared] -> Visible as a `finding` with the paths; main-thread git remains the user's to amend. P9 already removes Edit and Write from the orchestrator during `execute`.
- [A fingerprint of an entry without a file ref is missing, so a location-less finding never oscillates] -> The budget still bounds the loop; the ladder ends either way.
- [Checkpoint commits add history noise (design risk)] -> Only `.bdk/changes/<id>/` is staged; squash at close is T30's option, default off.
- [A user git hook fails the checkpoint every time] -> The checkpoint reports `skipped` with the hook's line; the task commits still carry the Change directory.

## Migration Plan

No user data exists in the v3 layout yet; the attempt record stays at schema version 1 because the `loop` field was always a free string and only the documented list changes. The v2 manifest `.bdk/runs/*.json` is not read; `import` (T32) owns the v2 path. Rollback is reverting the PR; the committed files it writes are valid T14 documents.

## Open Questions

- Whether `policy.escalation.per-change` should count per part instead of per Change for `large` Changes; the count is a policy value, so a later task can change the default without touching the specs' structure.
