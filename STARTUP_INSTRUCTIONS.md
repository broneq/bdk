# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## Agents

BDK ships these subagents. Invoke one through the Agent tool with its `subagent_type`. An agent whose description names the skill that spawns it belongs to that skill: let the skill orchestrate it instead of invoking it directly.

<!-- bdk:agents-table -->

| `subagent_type`      | Model  | When to pick                                                                                                                                                                    |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bdk:lead`           | sonnet | BDK adapter for the lead of one plan part, which dispatches its tasks to background agents, waits for them and commits them. Started by the swarm skill; not for general tasks. |
| `bdk:reader`         | opus   | BDK read-only adapter for deep verification (verifier, design-verifier). Started by BDK role skills; not for general tasks.                                                     |
| `bdk:reviewer`       | sonnet | BDK read-only adapter for code review with test runs (reviewer, pr-reviewer). Started by BDK role skills and the swarm skill; not for general tasks.                            |
| `bdk:runner`         | haiku  | BDK adapter that runs the project's tests and checks for a dispatch package (runner). Started by BDK role skills and the swarm skill; not for general tasks.                    |
| `bdk:scout`          | haiku  | BDK read-only adapter for fast searches and log triage (scout). Started by BDK role skills and the swarm skill; not for general tasks.                                          |
| `bdk:web-researcher` | haiku  | Internet research for debugging, finding solutions, and gathering technical information. Searches GitHub issues, Stack Overflow, Reddit, forums, and documentation.             |
| `bdk:worker`         | sonnet | BDK adapter for dispatched work that edits files (implementer and simplify packages). Started by BDK role skills and the swarm skill; not for general tasks.                    |

<!-- /bdk:agents-table -->

### Continuing a Spawned Agent (SendMessage)

Every Agent tool result includes an `agentId:` envelope and a `SendMessage` hint. You can resume the same agent with full prior context instead of spawning a fresh one.

**Continue (`SendMessage` to existing agent)** when:

- Follow-up genuinely depends on the agent's prior reasoning or findings
- Within ~5 min of original call (cache still warm)
- Narrow scope: clarification, "now check X given what you found", surfacing one more detail

**Spawn fresh `Agent`** when:

- Independent task with no relation to prior work
- Parallel work (multiple agents in one message)
- Original agent's context is stale or irrelevant
- Different `subagent_type` needed

**Cost**: SendMessage past the 5-min cache window pays a full cache miss for the resumed agent's prior context. Prefer fresh spawn for small self-contained follow-ups.

Pattern: `SendMessage(to: "<agentId>", message: "...")` - never re-include the original prompt; the agent already has it.

## Verification Proportionality

Match verification to what changed. Never run the full suite "just to be safe" after a small edit.

| Changed files                                                                  | Verification                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Non-executable content only (yaml/md/json/config not feeding build or codegen) | No tests, no typecheck. At most a syntax/schema validator if configured. |
| Source files                                                                   | Scoped/related tests + scoped lint; incremental typecheck.               |
| Build-feeding config (tsconfig, lockfile, codegen schema)                      | Treat as source.                                                         |
| Full suite                                                                     | Only when explicitly asked, or at a pipeline's end-of-plan gate.         |

## Quality Rules

BDK ships rules by id (`BDK-CQ-4`), one file each; a project adds its own in `.bdk/rules/` and switches any off with `rules.disabled`. An agent reads the rules of its ticket with `bdk rules show --ticket <ticket>` and cites the id of every rule that shaped its work. See README "Quality Rules".

## Capture Conventions

Before recording a convention or lesson anywhere, route it:

| The knowledge                                           | Where it goes                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Cross-cutting invariant whose violation fails silently  | `.claude/rules/`, scoped by the narrowest `paths:` that covers it |
| Trap visible at the code site where the mistake happens | a doc comment there                                               |
| Something a test or lint already enforces               | one line naming the enforcer                                      |
| Anything else                                           | nothing                                                           |

A line that a rename or file move would force you to edit is a code mirror, not a rule. **"Nothing" is the frequent, correct answer** - never write something down just to have written it. `/bdk:rules capture` runs this routing and adopts a rule through `bdk rules accept`; `/bdk:rules audit` turns recurring lessons into rules and prunes what no longer applies.
