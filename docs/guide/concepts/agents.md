# Agents

BDK runs its work through subagents because of context: a subagent gets its own window, does one job, writes its result where the kernel keeps it, and throws the rest away. The orchestrator pays for the result, not for the search that produced it.

## Roles and adapters

The work an agent does is a **role**: implementer, simplifier, verifier, design-verifier, reviewer, integration-reviewer, pr-reviewer, runner, scout or lead. A role is a skill under `skills/roles/`: the contract of what the agent reads, does, writes and returns. What the agent works on comes in a **dispatch package** that `bdk dispatch build` writes for one ticket: the task or review group, the decisions and blockers that bind it, the rules it reads and the report path.

An **adapter** is the agent file that runs a role: a tool set and a model, and nothing else. Six adapters cover the ten roles:

| Adapter        | Model  | Runs                                                 |
| -------------- | ------ | ---------------------------------------------------- |
| `bdk:lead`     | sonnet | a lead of one plan part                              |
| `bdk:worker`   | sonnet | implementer and simplifier, the only roles that edit |
| `bdk:reader`   | opus   | verifier, design-verifier and integration-reviewer   |
| `bdk:reviewer` | sonnet | reviewer and pr-reviewer                             |
| `bdk:runner`   | haiku  | runner, which runs the project's checks              |
| `bdk:scout`    | haiku  | scout, which answers a search question               |

`bdk:web-researcher` is the one agent outside the roles; any session can start it for external documentation and issue lookups. Full tool lists are in the [Agents reference](../reference/agents.md).

## Model choice is a cost decision

The model is fixed per adapter, not chosen per call:

- **haiku** for mechanical work with a narrow, checkable output: running the checks, searching the tree.
- **sonnet** for writing and reviewing code, where judgement about the change is the deliverable.
- **opus** for the roles that exist to disagree with a draft or a whole range: plan and design verification, and the integration review.

When a task uses up its attempts, its escalation ticket runs on a stronger model (`policy.escalation.model`) instead of the adapter's: the escalation is a better model, not only one more try.

## Read-only means read-only

Agents that must not write are constrained by their tool list, not by an instruction in prose: only `bdk:worker` carries `Edit` and `Write`. The orchestrating skills apply the same technique to their own turn: `/bdk:execute`, `/bdk:close`, `/bdk:cr` and `/bdk:pr-review` declare `disallowed-tools: Edit Write NotebookEdit`, so "the coordinator changes no file" is a property of the turn rather than a promise in the prompt.

## Each agent reads its own context

Subagents do not inherit the session's shared foundation, and an agent file cannot run the `!` context lines a skill has. A role agent therefore gets everything from its package and from kernel commands the package names: its rules with `bdk rules show --ticket <ticket>`, the ledger entries it needs with `bdk log list --for <target>`, and, for a runner, the project's commands in the package's `Checks` section. The mechanism is described in [The shared foundation](shared-foundation.md).

## Structured returns, not prose

An agent that answers in free prose forces the orchestrator to parse English, and the failure mode is silent: a reply that reads fine but omits the one field the caller needed.

So every role writes its findings and decisions to the ledger with `bdk log add`, and stores its report through `bdk log ingest --ticket <ticket>`, which checks the envelope (`status`, `files`, `entries`, `evidence`, `reason`) and refuses a malformed one. The agent then returns only the envelope. The orchestrator reads the ledger and the stored report, never the agent's reply.

## Continuing an agent instead of spawning one

Every Agent result includes an `agentId` and a `SendMessage` hint, so you can resume the same agent with its prior context intact.

**Continue** when the follow-up genuinely depends on what that agent already found, the scope is narrow, and you are within roughly five minutes of the original call while the cache is still warm.

**Spawn fresh** when the task is independent, when you want several agents working in parallel, when the earlier context is stale, or when you need a different agent type.

The five-minute window is a cost boundary, not a correctness one. A `SendMessage` past it pays a full cache miss for the resumed agent's prior context. The swarm skill resumes an agent at most once, when it returned without a stored report or its report was refused.

## The tree

The tree is deliberate and bounded: a `lead` runs one plan part and starts its part's role agents, and a `worker` may start a `scout`; no other adapter carries the `Agent` tool. The [Agents reference](../reference/agents.md#the-tree-the-registry-and-messages) describes the tree, the agent registry and messages.

## Related

- [Code review](../workflows/code-review.md) for how `/bdk:cr` runs reviewer agents per group of the change.
