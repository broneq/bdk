# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## Agents

BDK ships these subagents. Invoke one through the Agent tool with its `subagent_type`. An agent whose description names the skill that spawns it belongs to that skill: let the skill orchestrate it instead of invoking it directly.

<!-- bdk:agents-table -->

| `subagent_type`             | Model  | When to pick                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bdk:architecture-reviewer` | opus   | Cross-cutting architectural analysis - layer boundaries, DI, design patterns, data flow, directory structure, import direction                                                                                                                                                                               |
| `bdk:code-reviewer`         | sonnet | Layer-group code reviewer - deep review of assigned source files and their tests, produces structured findings. Spawned by /bdk:cr.                                                                                                                                                                          |
| `bdk:dead-code-detector`    | haiku  | Find unused functions, methods, variables, and unreachable code blocks using reference checking                                                                                                                                                                                                              |
| `bdk:design-verifier`       | opus   | Verify a design draft (product / architecture / combined) in a single pass — structured checklist covering self-critique completeness, Mermaid presence, NFR coverage, codebase grounding, and "What we did NOT decide" honesty. Spawned by /bdk:design Phase 3. Resume via SendMessage for delta iteration. |
| `bdk:duplicate-detector`    | haiku  | Find duplicated code and extractable patterns - searches changed symbols for literal duplicates, structural patterns, and intra-function duplication                                                                                                                                                         |
| `bdk:explorer`              | haiku  | Fast read-only codebase exploration - searches code, symbols, patterns, dependencies                                                                                                                                                                                                                         |
| `bdk:fixer`                 | sonnet | Apply a specific list of findings (from a reviewer, linter, or test failure) to the codebase. Receives findings and file paths inline; never reads the plan file. Spawned by /bdk:subagent-execute-plan.                                                                                                     |
| `bdk:implementer`           | sonnet | Implement one plan task end-to-end — TDD red-green, lint-clean, left uncommitted for the coordinator. Receives full task text and test cases inline; never reads the plan file. Spawned by /bdk:subagent-execute-plan.                                                                                       |
| `bdk:log-analyzer`          | haiku  | Delegate here to analyze stderr output, error logs, stack traces, and debug command failures. Fast triage of what went wrong.                                                                                                                                                                                |
| `bdk:plan-verifier`         | opus   | Verify an implementation plan against real code in a single pass — six-section structured checklist covering signature drift, data trace, edge cases, regression flows, test coverage, and plan completeness. Spawned by /bdk:verify-plan. Resume via SendMessage for delta iteration.                       |
| `bdk:static-analyse`        | haiku  | Detect and run project-appropriate static analysis tools (lint, format, type check) across Python, JS, Go, Rust and other stacks                                                                                                                                                                             |
| `bdk:test-runner`           | haiku  | Run test suite and report results. Pass test targets (files, dirs) in prompt or omit for full suite.                                                                                                                                                                                                         |
| `bdk:web-researcher`        | haiku  | Internet research for debugging, finding solutions, and gathering technical information. Searches GitHub issues, Stack Overflow, Reddit, forums, and documentation.                                                                                                                                          |

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

Pattern: `SendMessage(to: "<agentId>", message: "...")` — never re-include the original prompt; the agent already has it.

## Verification Proportionality

Match verification to what changed. Never run the full suite "just to be safe" after a small edit.

| Changed files                                                                  | Verification                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Non-executable content only (yaml/md/json/config not feeding build or codegen) | No tests, no typecheck. At most a syntax/schema validator if configured. |
| Source files                                                                   | Scoped/related tests + scoped lint; incremental typecheck.               |
| Build-feeding config (tsconfig, lockfile, codegen schema)                      | Treat as source.                                                         |
| Full suite                                                                     | Only when explicitly asked, or at a pipeline's end-of-plan gate.         |

## Quality Rules

BDK ships language-agnostic `code-quality`, `architecture`, `design-patterns`, and `security` rule sets used by `/bdk:cr` and `/bdk:create-plan`. Override or extend them with prompt values (`.bdk/prompts/rules/<name>.md`, or `prompts.files` in `.bdk/settings.yaml`). See README "Quality Rules" for the four usage patterns.

## Capture Conventions

Before recording a convention or lesson anywhere, route it:

| The knowledge                                           | Where it goes                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Cross-cutting invariant whose violation fails silently  | `.claude/rules/`, scoped by the narrowest `paths:` that covers it |
| Trap visible at the code site where the mistake happens | a doc comment there                                               |
| Something a test or lint already enforces               | one line naming the enforcer                                      |
| Anything else                                           | nothing                                                           |

A line that a rename or file move would force you to edit is a code mirror, not a rule. **"Nothing" is the frequent, correct answer** - never write something down just to have written it. `/bdk:add-rule` runs this routing properly; `/bdk:refine-rules` cleans up what accumulated.
