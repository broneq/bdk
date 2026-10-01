# Design

## Context

See proposal.md - Why. The facts this design stands on are the 2.1.284 rows of docs/HOST-FACTS.md; each decision below cites the rows it depends on. The current orchestration is T23's: the swarm skill (T23-D50, flat), role adapters without `Agent` (T23-D20), the ledger as the channel (T23-D15), the package path as the prompt and a single resume (`role-contracts`). The kernel runs no agents itself (T23-D6), and hooks start Node only when the shell prefilter lets a payload through (`kernel-cli/hooks`, Guard hooks file and prefilter).

The decisions were taken with the user on 2026-09-30 in two review rounds (topology, then registry, continuation and prompt convention). Each one records the alternative that was rejected.

## Goals / Non-Goals

**Goals:**

- A lead can coordinate a plan part: dispatch, wait, react to a message within about a second, and never lose a child that ended without a signal.
- Every agent can find the agents it needs to tell something, without the orchestrator relaying IDs.
- A turn that ends while ready work remains is sent back to that work by a deterministic check, not by prompt wording.
- All substance between agents stays in files; messages are pointers.

**Non-Goals:**

- A kernel-side process manager or worker pool. The host starts and runs every agent (T23-D6).
- The stage skills that use this layer (`execute` and the others): later T41 Changes. Wave strategy inside `execute` and the place of `features.workflow` are resolved in the `execute` Change.
- A time budget per part. Only elapsed time is signalled until measurements exist (T41-D8).

## Decisions

### T41-D1 A lead waits in `bdk agents wait`

A lead starts its children with `Agent` and `run_in_background: true`, then loops on `bdk agents wait` through `Bash`. The command blocks inside Node and returns the first of: a message queued for the caller, a child's report stored or its end recorded, a child turned `suspect`, or a timeout (below the host's 10-minute `Bash` limit). After it returns the tool round ends, so the host delivers any queued message (`send-live`). The model spends no tokens while it blocks.

Why: a subagent lead has no other way to wait and stay reachable. Ending its turn ends the lead (`lead-detach`); blocking in foreground `Agent` calls makes it deaf until all return (`lead-fg`).

Alternatives: an actor model where the lead ends its turn and children wake it with `SendMessage` (`lead-resume`) - rejected: a child cut off by `maxTurns` or killed never wakes it (`stop-on-maxturns`, `stop-on-taskstop`), and `main` sees the lead as finished at once. A flat swarm run by `main` (T23-D50) - kept for small Changes (T41-D3), rejected as the only mode because `main`'s context grows with every envelope and every reaction passes through it.

### T41-D2 One lead per plan part

A lead owns one plan part: its tickets, the waves inside the part (disjoint `Files:`), the post-task steps under each ticket and `attempt close`. It returns one envelope for the part.

Why: a part is the unit the plan already bounds (P6 fields, at most 8 KB) and the unit `part done` closes, so the lead's scope and its completion condition come from existing state.

Alternatives: one lead per wave - rejected, a wave crosses parts and has no completion record of its own; a model-chosen split - rejected, not deterministic and not testable.

### T41-D3 The kernel decides tree or flat

A wave runs as a tree when it holds at least two independent parts, and flat otherwise; the `tiny` and `small` profiles always run flat. The kernel, not the model, applies the rule. Its home is the wave that `bdk next` hands `/bdk:execute`, which the `v3-t41-execute` Change redesigns, so the rule, its setting and its tests land there; this Change delivers everything a tree needs to run.

Why: the Opus 5 guide warns that delegation multiplies cost on small work; a threshold in the kernel keeps the choice reproducible and measurable in evals.

Alternatives: always a tree - rejected, an extra lead context for one-part work; the model decides - rejected, not deterministic.

### T41-D4 Layer 3 only for `scout`

Depth: `main` (0) - lead (1) - role agents (2). A `worker` may start a `scout` (3) for investigation, at most `execution.scout.max-per-ticket` per ticket (default 2). The `lead` adapter lists `Agent(worker, runner, reviewer, scout)`; the `worker` adapter lists `Agent(scout)`; no other adapter lists `Agent`. The host's own depth limit is 3 below the main thread (`nested-agents`).

Why: a scout keeps a worker's context small on wide searches, and the restricted `Agent(...)` list keeps the tree from growing sideways.

Alternative: workers as leaves - rejected by the user in favour of cheap investigation offload.

### T41-D5 Messages are pointers, guarded

Every signal between agents is a ledger entry first (`bdk log add`); the message carries its id and one sentence. Routing: upward to the agent's lead (ID from the start context, T41-D6), critical to `main` (unchanged from T23-D15), lateral to the IDs `bdk agents list --affected-by <entry>` returns (the running agents whose ticket's `Files:` or task overlap the entry's refs). A `PreToolUse` guard on `SendMessage` denies a message to an agent that is not `running`, a message without a ledger reference, and a message longer than `agents.message.max-chars` (default 300). A receiver reads the entry and continues, adapts within its package, or returns `blocked`; the role contracts gain one paragraph on this.

Why: the host has no names or roster (`agent-params`), a message to a finished agent resumes it (`send-by-id`), and the user's rule is that substance lives in files.

Alternative: lateral messages only through the lead - rejected, it adds a round trip for the most time-sensitive case (two agents about to touch related files).

### T41-D6 Registry: lifecycle in its own SQLite file, heartbeat as file mtime

- **Start.** A `SubagentStart` hook records `agent_id`, `agent_type` and `session_id`, and answers with `additionalContext` naming the agent's own ID (`start-context`; without it an agent does not know its ID).
- **Parent.** A `PostToolUse` hook on `Agent` links `tool_response.agentId` to the caller's `agent_id` (absent for `main`). With background spawns this arrives at launch (`agent-link`), which is why leads spawn in the background.
- **Heartbeat.** The shell prefilter touches `.bdk/.machine/agents/<agent_id>` on every tool call of a subagent, without starting Node; an unmatched `PreToolUse` marks an open call.
- **End.** `SubagentStop` that the continuation check lets pass, `PostToolUse` on `TaskStop` (its `task_id`), or the parent's foreground `Agent` result. A stored report is read from the package's `report` path, not recorded as an end, because the agent still returns its envelope after it. A new session ends, as `stale`, the rows of other sessions silent for longer than the TTL, and leaves a session that still runs next to it alone. A heartbeat newer than the end makes a resumed agent `running` again.
- **Suspect.** No heartbeat for `agents.ttl` (default 5 min) with no open call, or an open call older than `agents.open-call-limit` (default 12 min), makes a row `suspect`. Any later heartbeat makes it `running` again.

Rows live in their own database, `.bdk/.machine/agents.sqlite`, machine-local and never committed (`kernel-state`, Ignored paths). Not in `index.sqlite`: that file is a cache of committed files, dropped and rebuilt on any version change (`kernel-state`, Rebuildable index), while the registry is live state no file can rebuild. Parent and package come from the parent's `Agent` call: `tool_input.prompt` holds the package path (`guard/dispatch-prompt` ensures it), so a background child's `SubagentStart` answer can already name its parent and its ticket.

Why: `SubagentStop` is missing exactly in the failure cases (`stop-on-maxturns`, `stop-on-taskstop`), so the end must come from several signals plus a lease. `suspect` instead of `ended` makes a wrong guess cheap: it only stops lateral messages to the agent and wakes its lead, which applies the single resume it applies today.

Alternatives: end only on `SubagentStop` - rejected, stale rows forever; a Node call per tool call for the heartbeat - rejected, it breaks the hook latency budget (`kernel-cli/hooks`, NFR "Latency").

### T41-D7 Continuation hooks

`Stop` for `main` and `SubagentStop` for subagents call the kernel, which answers `{"decision": "block", "reason": ...}` (`stop-block`) when:

- `main`: a stage skill is active and `bdk next` has ready work, no `question` is open, no manual gate is next and nothing runs in the background (`background_tasks`);
- a lead: its part has open task tickets, or its own report is not stored;
- a role agent: its package has no stored report.

It lets the turn end after three blocks in a row without progress (`agents.continuation.max`, default 3; progress is a new report or ledger entry in the agent's scope) and writes a `finding` that the agent stalled. `reason` names the open work and the command to run next.

Why: the Opus 5.5 guide recommends an external completion check with two or three automatic continuations over prompt wording alone, and T40 recorded the failure it prevents. For role agents it replaces the orchestrator's manual "missing report" resume.

Alternative: only a sentence in the skills - rejected, T40 run 1 stopped despite a correct `next`.

### T41-D8 Elapsed time for leads, no budget

Every `bdk agents wait` answer carries `elapsed` (seconds since the caller's `SubagentStart`), and so does every continuation reason for a lead; the lead contract carries one sentence that time matters and an earlier correct result is better.

Why: the Opus 5.5 guide reports faster team completion with a time signal; with no sensible budget per part it recommends elapsed time plus that sentence.

Alternatives: a budget from policy - deferred until evals give a baseline; `additionalContext` on every `PostToolUse` - rejected, not probed for subagents and a Node start per tool call, while a lead reads `wait` every round anyway.

### T41-D9 `main` waits on host notifications

The `execute` orchestrator starts leads in the background and ends its turn; the host's task notifications wake it when a background agent finishes (`lead-detach`: the completion notification goes to the main thread); a killed lead shows in the registry (`stop-on-taskstop`). T41-D7 keeps it from ending a turn while nothing runs and work is ready.

Why: `main` has the notification path that subagents lack, and a blocking `bdk agents wait` in an interactive `main` would hold the user's session.

Alternative: `bdk agents wait` in `main` too - rejected for the interactive case.

### T41-D10 Prompt convention for Opus 5.5

A dev-time rule file in `.claude/rules/` scoped to `skills/**` and `agents/**` (next to `skills.md`, which keeps the enforced checks). It carries: no verification instructions (the kernel's gates and evidence verify); the full task up front with goal, constraints and completion condition instead of a step script; named early stops to avoid; an explicit scope sentence for the implementer; reviewers report everything with severity and filtering happens elsewhere; explicit length calibration for written documents; delegation only for sizeable independent work; positive examples over prohibitions. Source: the Opus 5 and Opus 5.5 prompting guides.

Alternative: a section in `.claude/rules/skills.md` - rejected, that file is scoped to enforced conventions and generic authoring lives in `bdk-skill-kit`.

### T41-D11 A lead holds a `part-lead` ticket and a bounded set of orchestrator verbs

`main` opens a ticket in a new loop `part-lead` (target: the part id, budget `policy.budgets.part-lead`, default 2) and builds the lead's package with `dispatch build <part> lead <ticket>`, so a lead is dispatched, reported and resumed like every other role. A lead is a subagent, and `guard/subagent-kernel-command` denies subagents every `orchestrator` verb (T3). The guard lets an agent whose `agent_type` is `bdk:lead` run exactly `attempt open`, `attempt close`, `dispatch build` and `commit`, and only on targets inside the part of its own active package (from the registry). `part start`, `part done`, `change *`, `spec merge` and the rest stay with `main`. An `ok` close of a `part-lead` ticket answers `next.action: part-done`.

Why: without these verbs the lead cannot run a part, and without the part check a lead could close another lead's tickets.

Alternatives: `main` keeps every orchestrator verb and the lead only dispatches - rejected, every ticket round-trips through `main` and the tree gains nothing; a new availability class for leads - rejected, the exception is four verbs plus a scope check, which the guard states more precisely than a class.

### T41-D12 `commit` serialises across leads

Two leads of one wave commit tasks at the same time. `commit` takes an exclusive lock under `.bdk/.machine/` before it stages and releases it after the commit, waiting up to a bounded time; git's own `index.lock` would otherwise fail one of them.

Alternative: commits only from `main` after a part - rejected, it loses the per-task commits and trailers that `rebuild` and `part done` read.

### T41-D13 Effort per adapter

Adapters pin `effort` (HOST-FACTS `effort-frontmatter`): `medium` for `lead`, `worker` and `reviewer`, `high` for `reader`. The Opus 5.5 guide names `medium` the default and warns that higher effort lengthens every turn; that cost matters for the agents with many turns (a lead lives through a whole part, a worker and a reviewer run tests), not for `reader`, which runs rarely, in few turns, where a missed defect costs a whole execution. `runner` and `scout` keep their intent `low`, but Haiku runs without the frontmatter's effort level (HOST-FACTS `model-override`), so the Claude Code map writes no `effort` for the `fast` tier rather than a key that does nothing. The model tiers stay those of T23 (`docs/V3-SKILL-INVENTORY.md` 13.2); `lead` takes `balanced`, because it follows the kernel's `next.action` rather than deciding the work, and its context grows with every report. Nothing here is measured: T43 measures the pairs, and a project cannot change them (adapters are plugin content, T23-D19).

Alternative: host default everywhere - rejected, `reader` gains from more thinking and a `fast` agent has no effort to set. Alternative: `opus` for `lead` - rejected for now, the longest-living agent on the dearest model, for judgment the kernel mostly takes.

### T41-D14 Escalation runs on the escalation model

`policy.escalation.model` was printed by `attempt open --escalate` and applied by nobody, so an escalation was one more attempt on the same model. Now `attempt open --escalate` records the model in the ticket's attempt record, `dispatch build` copies it into each package of the ticket but a `runner` or `scout` one and returns it, the orchestrator (a lead for its tasks, `main` otherwise) starts the agent with the `Agent` call's `model` parameter, which overrides the adapter's model (HOST-FACTS `model-override`), and `hooks pre-tool` denies a start of such a package without that model (`guard/escalation-model`). The lead escalates its own tasks instead of returning `blocked`; `parked` still ends at the lead's `blocked`.

Alternative: role text only - rejected, a skipped `model` would silently repeat the failed model. Alternative: the guard reads the ticket's attempt record - rejected, the package's frontmatter is one file the prompt already names.

## Risks / Trade-offs

- [A lead stops looping on `wait` and ends its turn] → T41-D7 blocks the end while its part has open tickets; after three blocks without progress the stall is recorded and `main` sees the lead's envelope as incomplete.
- [Heartbeat TTL misjudges a long think at high effort] → `suspect` is reversible and only stops lateral messages and wakes the lead; the TTL is a setting.
- [Parent link of a foreground spawn arrives only at its end] → leads spawn in the background (T41-D6); a foreground spawn by `main` is linked at its end, which is enough for `main`'s own agents.
- [Hook latency grows with more events] → heartbeat is shell-only; the new Node hooks run once per agent lifecycle event, not per tool call; `pnpm test:perf` gains budgets for them.
- [Host behaviour changes in a later Claude Code] → every mechanism cites a HOST-FACTS row and its fixture; rerunning the probe after an upgrade shows the drift.
- [Model misreports message timing] → observed in `lead-fg`; nothing in the design depends on an agent's own account, only on hook payloads and files.

## Migration Plan

No user data migrates: the registry is a new machine-local file, created on first use and safe to delete. The `role-contracts` change regenerates `agents/` through `bdk export agents --host claude`. Rollback is a revert of the Change's commits; `agents.sqlite` left behind is ignored by an older kernel. Attempt records with `loop: part-lead` fail validation under an older kernel, which is the intended refusal for a downgrade mid-Change.

## Open Questions

- The poll interval inside `bdk agents wait` (a short sleep loop or `fs.watch` on the registry): an implementation detail, measured in `pnpm test:perf`.
- The exact `wait` timeout below the `Bash` limit (proposal: 5 minutes): tuned on the `execute` fixture.
- Whether a user stopping an agent in `/tasks` produces any hook (not probed; the lease covers it either way).
