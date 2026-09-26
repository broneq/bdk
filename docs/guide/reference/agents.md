# Agents

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

BDK ships 13 subagents. Every agent is invoked via the `Agent` tool with the `subagent_type` shown below, always in the namespaced form `bdk:<name>`. This page mirrors the split `STARTUP_INSTRUCTIONS.md` injects into every session: agents an orchestrator picks directly, and agents a skill spawns as an internal implementation detail. For what each agent's own `tools:`/`skills:` frontmatter grants it, see the source files under `agents/*.md`; for how agents get resumed instead of respawned, see [Agents](../concepts/agents.md).

## Directly invokable by the orchestrator

General-purpose helpers any session can call with the `Agent` tool.

| `subagent_type`             | Model | When to pick                                                                                                                                  |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `bdk:explorer`              | haiku | Broad codebase search spanning more than 3 queries, with Read, Grep, Glob and Bash.                                                           |
| `bdk:log-analyzer`          | haiku | Stderr/traceback/error-log triage.                                                                                                            |
| `bdk:web-researcher`        | haiku | External docs, GitHub issues, Stack Overflow lookups.                                                                                         |
| `bdk:static-analyse`        | haiku | Detect and run project-appropriate lint/format/typecheck across Python, JS, Go, Rust, and other stacks.                                       |
| `bdk:test-runner`           | haiku | Run the test suite (or a targets/dirs subset passed in the prompt) and report results.                                                        |
| `bdk:dead-code-detector`    | haiku | Find unused functions, methods, variables, and unreachable code blocks via reference checking.                                                |
| `bdk:duplicate-detector`    | haiku | Find duplicated code and extractable patterns - literal duplicates, structural patterns, intra-function duplication.                          |
| `bdk:architecture-reviewer` | opus  | Cross-cutting architectural analysis: layer boundaries, DI, design patterns, data flow, directory structure, import direction.                |
| `bdk:plan-verifier`         | opus  | Single-pass, six-section plan verification against real code; resumable via `SendMessage` for delta iteration. Spawned by `/bdk:verify-plan`. |

## Used by skills internally

Not meant to be invoked directly - let the owning skill orchestrate them.

| `subagent_type`       | Model  | Owner skill                                                                                                                                                                                                                                             |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bdk:code-reviewer`   | sonnet | `/bdk:cr` - layer-group deep review of assigned source files and their tests, producing structured findings.                                                                                                                                            |
| `bdk:implementer`     | sonnet | `/bdk:subagent-execute-plan` - implements one plan task end-to-end (TDD red-green, lint-clean), left uncommitted for the coordinator; receives the task text and test cases inline, never reads the plan file itself.                                   |
| `bdk:fixer`           | sonnet | `/bdk:subagent-execute-plan` - applies a specific list of findings (from a reviewer, a linter, or a test failure) to the codebase; receives findings and file paths inline, never reads the plan file.                                                  |
| `bdk:design-verifier` | opus   | `/bdk:design` - single-pass verification of a design draft (self-critique completeness, Mermaid presence, NFR coverage, codebase grounding, and "what we did NOT decide" honesty); spawned at Phase 3, resumable via `SendMessage` for delta iteration. |

## Read-only enforcement

No agent's own frontmatter carries a `disallowed-tools` key - checked directly against all 13 `agents/*.md` files. Read-only behavior for the review and verification agents (`bdk:code-reviewer`, `bdk:architecture-reviewer`, `bdk:dead-code-detector`, `bdk:duplicate-detector`, `bdk:plan-verifier`, `bdk:design-verifier`, `bdk:log-analyzer`, `bdk:explorer`, `bdk:web-researcher`) comes instead from their `tools:` allowlist simply never granting `Edit`, `Write`, or `NotebookEdit`.

The mechanical, promise-free guarantee lives one level up, on the orchestrating skills that spawn reviewer fleets: `skills/cr/SKILL.md` sets `disallowed-tools: Edit NotebookEdit` (with `Write` narrowed to `Write(.bdk/cr/**)`), and `skills/pr-review/SKILL.md` sets `disallowed-tools: Edit Write NotebookEdit`. Removing the tools from the pool for the whole skill turn is what makes "review only" a property of the turn rather than a claim in prose - see each skill's own Safety Rules section in the [Skills reference](skills.md).
