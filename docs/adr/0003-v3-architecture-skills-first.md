---
status: accepted
date: 2026-10-07
decision-makers: broneq
---

# ADR-0003: v3 architecture - logic in skills, leads for long stages, OpenSpec with a BDK schema, one writer of run state

## Context and Problem Statement

BDK v2 is slow, checks code rather than the product, keeps no living documentation and is hard for teams to adapt. The first v3 attempt (`draft/v3-1`) put the process into a TypeScript kernel that held the stage order, started one agent per task and checked every agent through a ledger and guards. It failed on speed and on product-level correctness. Models change week to week, so whatever governs the process outside the skill text has to be rewritten each time they do. Where does orchestration live, what holds the living documentation, and who holds the state of a run?

The full design, with flows, the catalog of skills, the risk register and the open items, is in [`docs/design/2026-10-07-v3-architecture.md`](../design/2026-10-07-v3-architecture.md).

## Decision Drivers

- Logic lives in skills; the `bdk` CLI only helps and never decides the order of the work.
- A new skill starts as a plain skill with an eval; a helper, hook or workflow comes only for a measured, recorded problem.
- Many small blocks composed by orchestrators, each usable and evaluable alone.
- Speed: for a change the size of B1, execute in at most 15 minutes and approved plan to PR in at most 45 minutes of machine time.
- Correctness of the product: acceptance tests from the spec, E2E run as a user would, integration review, spec conformance.
- Living documentation of behaviour, and configuration by teams.
- When goals conflict: quality, then speed, then tokens.

## Considered Options

**Orchestration (D1):**

1. **A - orchestrator skill in the main thread.**
2. **B - dynamic workflow** for mechanical stages.
3. **C - lead agent per stage**, running the stage skill and returning a summary.

**Living documentation (D2):**

1. **D2-1 - OpenSpec as is**, plus architecture docs kept current by a skill.
2. **D2-2 - OpenSpec with a BDK schema** whose Change artifacts match the BDK stages.
3. **D2-3 - own lightweight format** and merge in BDK.

**Run state (D3):**

1. **D3-0 - one writer of the state**, run artifacts by naming convention.
2. **D3-1 - plan file as the source of truth**, with CLI helpers from the start.
3. **D3-2 - the CLI holds all state**, and skills report every transition through commands.

## Decision Outcome

**Chosen: A and C together, D2-2, D3-0.**

- **Orchestration.** Every orchestrator is a skill. Stages that talk to the user (propose, design, plan, triage, close, debug, setup) run in the main thread. Long mechanical stages (execute, a review round, PR review) run as a stage skill in a `bdk:lead` agent. In an interactive session the main thread starts the lead in the background; in non-interactive runs it starts it in the foreground. The lead starts its workers as parallel foreground calls, one agent per plan part, never one per task. B stays an option for a lead that measurements show to be purely mechanical.
- **Stages and loops.** Propose, design, plan, execute, auto-review, close, then the next Change of the queue. Each stage runs an author block and a verifier block in a loop until PASS or the budget runs out, and every step writes a file.
- **Living documentation.** OpenSpec is required in a BDK project, with a BDK schema installed by `/bdk:setup`: proposal, spec deltas, design, and plan parts as separate files. `openspec archive` merges the spec deltas into the living specs. Architecture documentation is not synced.
- **Run state.** Run artifacts live in `.bdk/runs/`, outside git. `state.json` (part progress, JSON) has one writer, the execute lead; `run.json` (the queue) has one writer, `/bdk:run`. Findings are an append-only event log written through `bdk findings`. After a break, `/bdk:run` derives the open stage of a Change from files.
- **Autopilot.** `/bdk:run` drives the stage loop by its own skill text, the whole queue in one session, relying on compaction and resume from files. A `Stop`/`SubagentStop` hook engine is not built in v3.0.
- **Hooks.** `SessionStart` (a warning without configuration) and an optional `subagent-git` guard that blocks workers from changing git history and lets the lead commit and merge. The draft 1 process-order, write-scope and agent-tree guards, the registry, the journal and the stage gate are removed.

It is the only combination that keeps the process in text a team can read and change, keeps the main thread out of long mechanical work, gives living specs without an own parser, and leaves no state that several writers can make drift.

### Consequences

- ✅ A stage is one skill; where it runs is a choice of caller, not a different architecture.
- ✅ The main thread gets one summary per long stage; a lead starts with a fresh context and can run on a cheaper model.
- ✅ Every step writes a file, so a run resumes after a break or a compaction, and later steps read earlier results.
- ✅ No CLI command is needed for a skill to work, except the configuration that every BDK skill requires.
- ❌ The subagent tree uses all 3 levels under the main thread (main, lead, worker, helper).
- ❌ OpenSpec project schemas are experimental in 1.13.2.
- ❌ Every block and orchestrator needs paid eval cases.
- 🟡 Without a hook engine, an autopilot run continues only as long as the model follows the `/bdk:run` loop; a measured pattern of early stops is the trigger for the hook engine.
- 🟡 One session for the whole queue depends on compaction; a measured drop in quality is the trigger for one session per Change.

### Implementation Requirements

- [ ] Initialise OpenSpec in this repository and write the BDK schema.
- [ ] `bdk config` with three layers and `/bdk:setup` (stack detection including `tools.e2e`, permission allow rules, OpenSpec init).
- [ ] `bdk check run`, `bdk git groups`, `bdk rules for`, `bdk plan check`, `bdk findings`, `bdk run status`.
- [ ] Each block as a plain skill with its eval cases, then the orchestrators.
- [ ] Host probes: `!` in skills preloaded with `skills:`, `AskUserQuestion` in a subagent, a background lead in `claude -p`, concurrency of subagents.

## Pros and Cons of the Options

### A - orchestrator skill in the main thread

- ✅ Asks the user directly; simplest; logic is plain skill text.
- ❌ Every agent result is a main-thread turn; long stages fill the context, the largest cost of B1.

### B - dynamic workflow

- ✅ Deterministic loop; intermediate results stay out of every context.
- ❌ No user input mid-run, no file access from the script, can be disabled by an organisation; orchestration moves from skill text into JS.

### C - lead agent per stage

- ✅ One summary per stage for the main thread; fresh context per stage; cheaper model.
- ❌ The lead cannot talk to the user; blockers travel through the main thread.

### D2-1 - OpenSpec plus synced architecture docs

- ✅ Covers architecture as well as behaviour.
- ❌ `openspec archive` merges only spec deltas, so the sync is a separate, unverified skill.

### D2-2 - OpenSpec with a BDK schema

- ✅ Change artifacts match the stages; living specs from `openspec archive`; no own parser.
- ❌ Depends on an experimental OpenSpec feature.

### D2-3 - own format

- ✅ Full control.
- ❌ Own parser, validation and merge to maintain, as in draft 1.

### D3-0 - one writer, naming convention

- ✅ Nothing to drift; no helper before a measured need.
- ❌ The naming convention is a contract between skills that evals must check.

### D3-1 - plan file plus CLI helpers

- ✅ Validated transitions from the start.
- ❌ Helpers built before any measurement shows the model getting it wrong.

### D3-2 - CLI holds the state

- ✅ One source of truth behind an API.
- ❌ A skipped command means a false state; every skill must call commands precisely; the draft 1 path (1,349 of 1,808 Bash calls in B1 were `bdk`).
