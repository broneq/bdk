# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## Tool Tier System

When exploring, searching, editing, or reviewing code, use the best available tool tier. The instructions below are injected based on your project's enabled features.

**Exploration & Architecture:**

<!-- CHAIN: explore.chain.json -->

**Symbol Search & Tracing:**

<!-- CHAIN: search.chain.json -->

**Impact Analysis:**

<!-- CHAIN: impact.chain.json -->

## Agents

BDK ships these subagents. Invoke via the Agent tool with the listed `subagent_type`.

**Directly invokable by orchestrator** (general-purpose helpers):

| `subagent_type` | Model | When to pick |
|---|---|---|
| `bdk:explorer` | haiku | Broad codebase search spanning >3 queries |
| `bdk:log-analyzer` | haiku | Stderr/traceback/error-log triage |
| `bdk:web-researcher` | haiku | External docs, GitHub issues, Stack Overflow lookups |
| `bdk:static-analyse` | haiku | Run project lint / format / typecheck |
| `bdk:test-runner` | haiku | Run tests and report results |
| `bdk:dead-code-detector` | haiku | Find unused/unreachable code |
| `bdk:duplicate-detector` | haiku | Find duplicated code and extractable patterns |
| `bdk:architecture-reviewer` | opus | Cross-cutting architectural analysis |
| `bdk:plan-verifier` | opus | Single-pass plan verification (used by `/bdk:verify-plan`) |

**Used by skills internally** — don't invoke directly; let the skill orchestrate:

| `subagent_type` | Model | Owner skill |
|---|---|---|
| `bdk:code-reviewer` | sonnet | `/bdk:cr` |
| `bdk:implementer` | sonnet | `/bdk:subagent-execute-plan` |
| `bdk:fixer` | sonnet | `/bdk:subagent-execute-plan` |

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

Pattern: `SendMessage(to: "<agentId>", message: "...")` — never re-include the original prompt; the agent already has it.

## Verification Proportionality

Match verification to what changed. Never run the full suite "just to be safe" after a small edit.

| Changed files | Verification |
|---|---|
| Non-executable content only (yaml/md/json/config not feeding build or codegen) | No tests, no typecheck. At most a syntax/schema validator if configured. |
| Source files | Scoped/related tests + scoped lint; incremental typecheck. |
| Build-feeding config (tsconfig, lockfile, codegen schema) | Treat as source. |
| Full suite | Only when explicitly asked, or at a pipeline's end-of-plan gate. |

## Quality Rules

BDK ships language-agnostic `code-quality`, `architecture`, `design-patterns`, and `security` rule sets used by `/bdk:cr` and `/bdk:create-plan`. Override or extend via the `quality` section in `.bdk/settings.json`. See README "Quality Rules" for the four usage patterns.

## Capture Conventions

Before recording a convention or lesson anywhere, route it:

| The knowledge | Where it goes |
|---|---|
| Cross-cutting invariant whose violation fails silently | `.claude/rules/`, scoped by the narrowest `paths:` that covers it |
| Trap visible at the code site where the mistake happens | a doc comment there |
| Something a test or lint already enforces | one line naming the enforcer |
| Anything else | nothing |

A line that a rename or file move would force you to edit is a code mirror, not a rule. **"Nothing" is the frequent, correct answer** - never write something down just to have written it. `/bdk:add-rule` runs this routing properly; `/bdk:refine-rules` cleans up what accumulated.
