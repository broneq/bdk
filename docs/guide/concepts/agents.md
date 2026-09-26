# Agents

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

BDK ships thirteen subagents. The reason there are that many, rather than one capable generalist, is context: a subagent gets its own window, does one job, returns a structured answer, and throws the rest away. The orchestrator pays for the answer, not for the search that produced it.

## The fleet

**Directly invokable** general-purpose helpers. Reach for these from any session via the Agent tool with the listed `subagent_type`:

| `subagent_type`             | Model | When to pick                                              |
| --------------------------- | ----- | --------------------------------------------------------- |
| `bdk:explorer`              | haiku | Broad codebase search spanning more than three queries    |
| `bdk:log-analyzer`          | haiku | Stderr, traceback, and error-log triage                   |
| `bdk:web-researcher`        | haiku | External docs, GitHub issues, Stack Overflow lookups      |
| `bdk:static-analyse`        | haiku | Run project lint, format, or typecheck                    |
| `bdk:test-runner`           | haiku | Run tests and report results                              |
| `bdk:dead-code-detector`    | haiku | Find unused or unreachable code                           |
| `bdk:duplicate-detector`    | haiku | Find duplicated code and extractable patterns             |
| `bdk:architecture-reviewer` | opus  | Cross-cutting architectural analysis                      |
| `bdk:plan-verifier`         | opus  | Single-pass plan verification, used by `/bdk:verify-plan` |

**Used by skills internally.** Let the owning skill orchestrate these rather than calling them yourself:

| `subagent_type`       | Model  | Owner skill                  |
| --------------------- | ------ | ---------------------------- |
| `bdk:code-reviewer`   | sonnet | `/bdk:cr`                    |
| `bdk:implementer`     | sonnet | `/bdk:subagent-execute-plan` |
| `bdk:fixer`           | sonnet | `/bdk:subagent-execute-plan` |
| `bdk:design-verifier` | opus   | `/bdk:design`                |

Full descriptions, tool lists, and preloaded skills are in [Agents reference](../reference/agents.md).

## Model choice is a cost decision

The model is fixed per agent, not chosen per call:

- **haiku** for mechanical work with a narrow, checkable output: running a command, reading logs, searching the tree. These agents are dispatched constantly during a plan run, so their cost compounds.
- **sonnet** for writing and reviewing code, where judgement about the change itself is the deliverable.
- **opus** for the three roles that exist to disagree with a draft: plan verification, design verification, and architectural review.

That last group is the interesting one. `bdk:plan-verifier` and `bdk:design-verifier` are separate agents that critique the author's own draft against real code, rather than the authoring skill checking its own work. Each returns a structured verdict envelope, and each supports a bounded iteration loop: a failing verdict is sent back once as a delta, and a second failure escalates to the user instead of looping.

## Read-only means read-only

Agents that must not write are constrained by their tool list, not by an instruction in prose. `bdk:explorer`, `bdk:architecture-reviewer`, and the verifiers carry no `Edit` or `Write` tool at all.

The same technique is used at skill level. `/bdk:cr` declares `disallowed-tools: Edit NotebookEdit` and `/bdk:pr-review` declares `disallowed-tools: Edit Write NotebookEdit`, which removes those tools from the pool while the skill is active. "Review only" is a property of the turn rather than a promise in the prompt.

## Each agent arrives pre-briefed

Subagents do not inherit the session's shared foundation. Each agent's frontmatter therefore lists the meta-skills it needs, and those resolve at spawn time: quality and language rules (`bdk-rules-*`), the project's commands (`bdk-lint-tools`, `bdk-test-tools`), and the shared return contract for implementers and fixers. The mechanism is described in [The shared foundation](shared-foundation.md).

The lists are deliberately uneven. `bdk:architecture-reviewer` gets architecture and design-pattern rules but not code-quality rules, because it reviews layering rather than function-level hygiene. `bdk:explorer` gets no rules, because it returns context and enforces nothing. `bdk:static-analyse` and `bdk:test-runner` get no rules, because they read no code, but each preloads its tool meta-skill: that skill carries the scoping policy, so callers pass paths and intent and the agent resolves which form of which command to run.

## Continuing an agent instead of spawning one

Every Agent result includes an `agentId` and a `SendMessage` hint, so you can resume the same agent with its prior context intact.

**Continue** when the follow-up genuinely depends on what that agent already found, the scope is narrow (a clarification, one more detail, "now check X given what you found"), and you are within roughly five minutes of the original call while the cache is still warm.

**Spawn fresh** when the task is independent, when you want several agents working in parallel, when the earlier context is stale or irrelevant, or when you need a different agent type.

The five-minute window is a cost boundary, not a correctness one. A `SendMessage` past it pays a full cache miss for the resumed agent's entire prior context, which is usually worse than a fresh spawn for a small self-contained follow-up. When you do continue, never re-send the original prompt: the agent still has it.

The plan executor applies the same reasoning with two extra constraints. A verification failure goes back to the original implementer when the cache is likely warm and the scope is narrow, and otherwise to a fresh `bdk:fixer`. Verifier agents are reused across fix cycles _within_ a group but never across groups, because each group's changed-file set is different.

## Structured returns, not prose

An agent that answers in free prose forces the orchestrator to parse English, and the failure mode is silent: a reply that reads fine but omits the one field the caller needed.

So the agents that feed a decision return a fixed envelope instead. `bdk:implementer` and `bdk:fixer` end every dispatch with a YAML block carrying one of four statuses (`DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`), and anything else is treated as `BLOCKED` with reason "malformed return". The verifier agents return their own verdict envelopes, which the calling skill parses and branches on.

The schema is not repeated in the dispatch prompt. It arrives at spawn through a preloaded meta-skill, so the prompt only has to say that the final message must be that envelope. A schema pasted into every prompt is a schema that drifts from the one source of truth and invites a well-meant shortening.

The same argument applies to the exploration agent that validates a plan's waves: it is pointed at a contract file to read rather than handed a copy of the schema, because a caller-supplied schema competes with the agent's own default output format and a shortened paste silently produces prose.

## What an agent cannot do

Subagents cannot spawn subagents. That is why skills which themselves dispatch a fleet, such as `/bdk:cr` and `/bdk:debug`, are never invoked from inside a subagent; the coordinator handles those flows directly. Skills that do not spawn anything, such as `/bdk:test-driven-development`, are invoked from inside subagents routinely.

## Related

- [The plan pipeline](plan-pipeline.md) for how the coordinator schedules this fleet.
- [Code review](../workflows/code-review.md) for how `/bdk:cr` scales reviewer agents to the size of the change.
