---
name: test-driven-development
description: >-
  Rigid TDD process for writing and verifying tests before implementation.
  Use when implementing any feature or bugfix. Receives test case bullet points
  from the plan and enforces red-green cycle.
---

# Test-Driven Development

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

A rigid, gated process focused on tests. Follow every gate in order. Do not skip ahead.

```dot
digraph tdd {
    rankdir=TB
    node [shape=box, style="rounded,filled", fillcolor="#f0f0f0"]

    start [label="Receive test cases\n+ implementation spec", shape=ellipse, fillcolor="#d4edda"]
    g0 [label="GATE 0\nLoad project context\nFind test conventions", fillcolor="#cce5ff"]
    g1 [label="GATE 1\nWrite tests from ✅ bullets\nGap scan for edge cases", fillcolor="#cce5ff"]
    g2 [label="GATE 2\nDelegate to test-runner\nExpect: ALL FAIL", fillcolor="#cce5ff"]
    tests_pass [label="Tests\nPASS?", shape=diamond, fillcolor="#fff3cd"]
    stop_investigate [label="STOP\nImplementation exists\nor test is wrong.", shape=ellipse, fillcolor="#f8d7da"]
    g3 [label="GATE 3\nImplement as described in plan", fillcolor="#cce5ff"]
    g4 [label="GATE 4\nDelegate to test-runner\nExpect: ALL PASS", fillcolor="#cce5ff"]
    green_pass [label="Tests\nPASS?", shape=diamond, fillcolor="#fff3cd"]
    fix_attempt [label="Fix implementation\n(attempt N/3)", fillcolor="#fff3cd"]
    too_many [label="STOP\nAsk user", shape=ellipse, fillcolor="#f8d7da"]
    attempts_left [label="Attempts\n< 3?", shape=diamond, fillcolor="#fff3cd"]
    done [label="Task done ✓", shape=ellipse, fillcolor="#d4edda"]

    start -> g0
    g0 -> g1
    g1 -> g2
    g2 -> tests_pass
    tests_pass -> stop_investigate [label="YES (unexpected)"]
    tests_pass -> g3 [label="NO (expected)"]
    g3 -> g4
    g4 -> green_pass
    green_pass -> done [label="YES"]
    green_pass -> attempts_left [label="NO"]
    attempts_left -> fix_attempt [label="YES"]
    attempts_left -> too_many [label="NO"]
    fix_attempt -> g4
}
```

---

## Input

The plan task provides:

```
**Test cases:**
- ✅ Positive: given [input], expects [output]
- ❌ Negative: given [invalid input], raises [error]

**Implementation:** [what to build — file path, class, method]
```

---

## GATE 0: Load Context

Read project context to understand:
- Test file conventions (where tests live, how they're named)
- Test framework being used
- Existing test patterns (fixtures, factories, assertions)

Identify the test file path following project conventions.

**Cannot proceed without understanding project test conventions.**

---

## GATE 1: Write Tests

Write tests for every ✅ bullet point. Follow project test conventions from GATE 0.

**Before writing, examine the implementation spec for:**
- Boundary conditions (empty list, zero, first/last element)
- Invalid types or missing required fields
- Unexpected None or absent optional data

Add test cases for meaningful gaps. **Do not add tests just to have more tests.**

**Negative tests (❌ bullets):** Write them when they provide real value. Skip if no meaningful failure modes exist.

**Cannot proceed until every ✅ bullet has a corresponding test.**

---

## GATE 2: Verify RED

Delegate to `test-runner` agent:

```
Run the project's test suite against: {test_file_path}
Expected: ALL written tests FAIL
```

**If tests PASS:** Stop. Either the implementation already exists or the test is wrong.

**If tests FAIL as expected:** Proceed to GATE 3. ✓

---

## GATE 3: Implement

Implement as described in the plan task. Keep it focused on making the tests pass — no extra features.

---

## GATE 4: Verify GREEN

Delegate to `test-runner` agent:

```
Run the project's test suite against: {test_file_path}
Expected: ALL tests PASS
```

**If tests FAIL:** Fix the implementation. Maximum 3 attempts. After 3 failures, stop and ask the user.

**If tests PASS:** Proceed. ✓

---

## Anti-Patterns

- ❌ Skipping GATE 2 ("I know it will fail")
- ❌ Writing implementation before tests exist
- ❌ Forcing a negative test when no real failure mode exists
- ❌ Hardcoding test commands — always detect the project's test runner
