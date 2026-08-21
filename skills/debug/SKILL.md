---
name: debug
description: >
  Debug issues through structured investigation, failing test creation, and targeted fixes.
  Use when the user provides an error message, traceback, steps-to-reproduce, or describes
  unexpected behavior.
argument-hint: "[error message, traceback, or steps to reproduce]"
model: opus
user-invocable: true
context: main
allowed-tools: AskUserQuestion Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

# Debug

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Diagnose bugs via structured investigation, reproduce with failing tests, then fix or plan.

**Announce at start:** "Using debug to investigate the issue."

**Core principle**: Understand first → test second → confirm with user → fix third.

**Run the phases strictly in order. Announce each one as you enter it** (`[debug] Phase 2: Investigate`), and do not enter the next phase until the current one is fully done:

- Phase 1: Parse Input
- Phase 2: Investigate
- Phase 3: Write Failing Tests
- Phase 4: Propose & Wait for User Decision ← **HARD STOP**

Phase 4 is a hard stop: you present the proposal, then end your turn. Do not begin Phase 5, do not start editing, and do not decide the path yourself — no matter how obvious the fix looks. Only an actual user reply releases the stop; a background task completing, a hook firing, or your own reasoning does not.

**After the user responds**: announce Phase 5 as the path they chose — "Fix Inline" or "Hand off to /bdk:create-plan" — then proceed.

---

## Decision Flow

```dot
digraph debug_flow {
    rankdir=TB
    node [shape=box, style="rounded,filled", fillcolor="#f0f0f0"]

    start [label="Phase 1\nParse Input", fillcolor="#d4edda"]
    investigate [label="Phase 2\nInvestigate"]
    tests [label="Phase 3\nWrite Failing Tests"]
    decide [label="Phase 4\nPropose & ASK USER\n(HARD STOP)", fillcolor="#fff3cd", shape=octagon]
    fix [label="Phase 5a\nFix Inline + Verify"]
    plan [label="Phase 5b\nHand off to /bdk:create-plan"]
    done [label="Done", fillcolor="#d4edda", shape=doublecircle]

    start -> investigate
    investigate -> tests
    tests -> decide
    decide -> fix [label="user: 'Fix now'"]
    decide -> plan [label="user: 'Create plan'"]
    decide -> investigate [label="user: 'Something else'"]
    fix -> done
    plan -> done
}
```

---

## The 5-Phase Workflow

### Phase 1: Parse Input

1. **Validate input**: If empty or vague, ask inline for details, then **stop**
2. **Extract key signals**: error type, failing component, steps to reproduce, expected vs actual
3. **Print summary**:
   ```
   [debug] Issue: {one-line summary}
   [debug] Signals: error={exception class or "none"}, component={file/class or "unknown"}
   ```

**GATE**: Must have enough signal to start investigation.

---

### Phase 2: Investigate

Inject available search tools:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`

Using the search tools above:
1. **Find entry point** — locate the error component or symbol
2. **Trace callers** — trace up the call chain
3. **Trace callees** — trace down to dependencies
4. **Identify impacted paths** — named execution paths through the suspected area
5. **Flag cascading risk** — highest-risk choke points in the affected module
6. **Identify root cause**
7. **Quantify blast radius** — understand scope before proposing fix:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/impact.chain.json`
8. **Scan for related test gaps** — same class of problem in nearby code only
9. **Print investigation summary**:
   ```
   [debug] Root cause: {one sentence}
   [debug] Affected: {file path}:{line range}
   [debug] Test gaps found: {N}
   ```

**GATE**: Must identify root cause before Phase 3.

---

### Phase 3: Write Failing Tests

Write tests that precisely reproduce bug. Tests RED until fix applied.

**Rules:**
- Each test concrete: specific input values, specific expected outcome
- Follow project test conventions (check existing tests for patterns)
- Place tests in correct existing test file

Inject test command: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`

Confirm the new tests are RED by running the matching tier's `scoped` form on the test file(s) you just wrote, **directly via `Bash`** — substitute `{files}` with those paths. No agent spawn: one test file's output is a few lines, and the spawn costs more wall-clock than the run. Never the `full` form of any tier, and never an e2e tier unless the tests you wrote *are* e2e specs.

```
[debug] Failing tests confirmed: {N} red
```

**GATE**: All new tests must be RED before proceeding.

---

### Phase 4: Propose Solution & Ask User (HARD STOP)

**Mandatory checkpoint. STOP and wait for user decision.**

**Step 1**: Describe proposed solution (what changes, why it fixes root cause, risks)

**Step 2**: Assess complexity:
- **LOW** (inline fix): isolated change affecting one function/call site
- **HIGH** (route to /bdk:create-plan): affects many call sites, introduces new abstractions, changes shared data models

**Step 3**: Ask user via `AskUserQuestion`:

```
## Proposed Fix
{solution summary}

## Complexity: {LOW or HIGH}
{justification}

## What would you like to do?
1. **Fix now** — apply the inline fix and verify tests pass
2. **Create plan** — hand off to `/bdk:create-plan` with failing tests as acceptance criteria
3. **Something else** — redirect, reconsider, investigate more

{recommendation}
```

**`AskUserQuestion` MUST be last tool call in this phase.**

> **HARD STOP: After calling `AskUserQuestion`, output NO text, call NO tools, take NO action. Turn ends here. Phase 4 task stays open. Phase 5 does not start until user replies.**

**GATE**: User explicitly chose option. Only then: mark Phase 4 complete, begin Phase 5.

---

### Phase 5a: Fix Inline

Inject project tools context:

- Test tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`
- Lint tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`

1. Apply minimal fix
2. Re-run the same scoped command from Phase 3 via `Bash` — only the tests you wrote
3. Confirm those tests GREEN
4. Delegate to `static-analyse`, passing **the files you changed** — it resolves the scoped lint/format and incremental typecheck forms itself. Do not ask for a project-wide sweep
5. Fix any issues
6. Regression check: delegate to `bdk:test-runner` with the changed source files, asking for the fast tier's `related`/`scoped` form. This is the one dispatch worth its spawn here — the output is large and the mapping from changed files to affected tests is exactly what the runner computes for you. Add an e2e tier only if the fix touched e2e specs or changed a public contract
7. Print final summary:
   ```
   [debug] Done.
     Root cause:   {one sentence}
     Tests added:  {N}
     Fix applied:  {brief description}
     Status:       all tests GREEN
   ```

---

### Phase 5b: Hand Off to /bdk:create-plan

1. Print: `[debug] Routing to /bdk:create-plan`
2. Invoke `/bdk:create-plan` passing:
   - Root cause as feature description
   - Steps to reproduce (verbatim)
   - Failing test file path and test names as acceptance criteria
   - Architectural constraints discovered during investigation

---

## Key Principles

- **Investigate before testing** — understand first
- **Tests define bug** — failing test is contract
- **Phase 4 is hard stop** — ALWAYS wait for user decision
- **Inline questions for info, AskUserQuestion for decisions**
- **Minimal fix** — change only what failing tests require
- **NEVER hardcode test or lint commands** — detect from project context

## Anti-Patterns

- NEVER fix before writing failing test
- NEVER proceed past Phase 4 without user confirmation
- NEVER route to /bdk:create-plan without passing failing test paths
- NEVER scan entire codebase for gaps — only code already read
- NEVER call any tool after `AskUserQuestion` in Phase 4 — turn ends there
- NEVER mark Phase 4 task complete before user responds
- NEVER start Phase 5 without first creating Phase 5 task and Phase 4 marked complete