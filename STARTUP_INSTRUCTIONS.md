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
| `bdk:step-simulator` | opus | Dry-run a plan with concrete data traces |

**Used by skills internally** — don't invoke directly; let the skill orchestrate:

| `subagent_type` | Model | Owner skill |
|---|---|---|
| `bdk:code-reviewer` | sonnet | `/bdk:cr` |
| `bdk:implementer` | sonnet | `/bdk:subagent-execute-plan` |
| `bdk:fixer` | sonnet | `/bdk:subagent-execute-plan` |

## Quality Rules

BDK ships language-agnostic `code-quality` and `architecture` rule sets used by `/bdk:cr` and `/bdk:create-plan`. Override or extend via the `quality` section in `.bdk/settings.json`. See README "Quality Rules" for the four usage patterns.
