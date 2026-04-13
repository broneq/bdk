---
name: verify-plan
description: >-
  Verify implementation plans before execution using a 4-agent pipeline.
  Use when you have a written plan (from /bdk:create-plan or manual) and want to check
  if it will actually work before writing code.
argument-hint: "[plan-file]"
---

# Verify Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Verify plans against real code before execution.

## Invocation

```
/bdk:verify-plan docs/plans/2026-03-17-some-plan.md
```

`$ARGUMENTS` = plan file path. Read file first.

## Decision Flow

```dot
digraph verify_plan {
    rankdir=TB
    node [shape=box, style="rounded,filled", fillcolor="#f0f0f0"]

    start [label="Read plan file", shape=ellipse, fillcolor="#d4edda"]
    parse [label="Extract:\n- Problem context\n- Files to change\n- Proposed code\n- Success criteria"]
    explorer [label="Stage 1: EXPLORER\nGather signatures, types,\nmodels, ALL callers of\nmodified symbols"]
    parallel_start [label="", shape=point, width=0.1]
    sim_a [label="Stage 2A: PLAN PROVER\nDry-run plan steps,\ninvent edge cases"]
    sim_b [label="Stage 2B: REGRESSION HUNTER\nTrace OTHER flows\nthrough changed code"]
    parallel_end [label="", shape=point, width=0.1]
    reviewer [label="Stage 3: CODE REVIEWER\nReview proposed code\nvs patterns"]
    verdict [label="Assemble VERDICT REPORT"]
    pass_check [label="PASS?", shape=diamond]
    done [label="Save report\nDone", shape=ellipse, fillcolor="#d4edda"]
    iter_check [label="Iteration < 3?", shape=diamond]
    rethink [label="Plan needs rethink.\nSuggest /bdk:brainstorming-session", shape=ellipse]

    start -> parse
    parse -> explorer
    explorer -> parallel_start
    parallel_start -> sim_a
    parallel_start -> sim_b
    sim_a -> parallel_end
    sim_b -> parallel_end
    parallel_end -> reviewer
    reviewer -> verdict
    verdict -> pass_check
    pass_check -> done [label="YES"]
    pass_check -> iter_check [label="NO"]
    iter_check -> explorer [label="YES\n(full re-run)"]
    iter_check -> rethink [label="NO (3 failures)"]
}
```

## Pipeline Execution

### Stage 1: Explorer

Launch `explorer` agent, thoroughness "very thorough":

```
Analyze the following implementation plan for verification.

PLAN:
<full plan content>

YOUR TASK:
1. For each file in "Files to change", get symbols overview
2. For each function/method the plan modifies, read its FULL current signature and body
3. For each model/class the plan references, read its fields and types
4. For ALL modified symbols, find every caller
5. List all flows that use the modified code paths

Focus on: current function signatures, parameter types, return types, model fields,
class hierarchies, callers, and downstream consumers.
```

### Stage 2A & 2B: Run in Parallel

Launch TWO `step-simulator` agents simultaneously using prompts in `references/agent-prompts.md`.

- **Stage 2A** — "Plan Prover" prompt, substitute `{plan_content}` and `{exploration_report}`
- **Stage 2B** — "Regression Hunter" prompt, substitute `{plan_content}` and `{exploration_report}`

### Stage 3: Code Reviewer

Launch `code-reviewer` agent on proposed code snippets with both simulator reports as context.

## Verdict Assembly

Merge all reports using structure in `references/verdict-template.md`. Save to `.bdk/verify-plan/<plan-name>-verification.md`.

## Loop Logic

1. PASS → save report, done
2. FAIL + iteration < 3: show remaining issues, ask to re-verify
3. FAIL + iteration >= 3: suggest `/bdk:brainstorming-session`

## Iteration Summary Format

```
## Iteration N/3 Summary

| Check            | Iter 1 | Iter 2 | Delta           |
|------------------|--------|--------|-----------------|
| Plan Proof       | 3 FAIL | 1 FAIL | Improved        |
| Regression Check | 1 WARN | 0 WARN | Fixed           |
| Code Review      | 0 FAIL | 0 FAIL | Clean           |
| **Overall**      | **FAIL**| **FAIL**| **4 → 1 issues** |
```