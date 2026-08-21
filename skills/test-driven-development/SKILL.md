---
name: test-driven-development
description: >-
  Rigid TDD process for writing and verifying tests before implementation.
  Use when implementing any feature or bugfix. Receives test case bullet points
  from the plan and enforces red-green cycle.
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

# Test-Driven Development

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Rigid, gated process. Follow every gate in order. No skipping.

```dot
digraph tdd {
    rankdir=TB
    node [shape=box, style="rounded,filled", fillcolor="#f0f0f0"]

    start [label="Receive test cases\n+ implementation spec", shape=ellipse, fillcolor="#d4edda"]
    g0 [label="GATE 0\nLoad project context\nFind test conventions", fillcolor="#cce5ff"]
    g1 [label="GATE 1\nWrite tests from ✅ bullets\nOne test per bullet", fillcolor="#cce5ff"]
    g2 [label="GATE 2\nRun scoped tests via Bash\nExpect: ALL FAIL", fillcolor="#cce5ff"]
    tests_pass [label="Tests\nPASS?", shape=diamond, fillcolor="#fff3cd"]
    stop_investigate [label="STOP\nImplementation exists\nor test is wrong.", shape=ellipse, fillcolor="#f8d7da"]
    g3 [label="GATE 3\nImplement as described in plan", fillcolor="#cce5ff"]
    g4 [label="GATE 4\nRe-run same command\nExpect: ALL PASS", fillcolor="#cce5ff"]
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

Plan task provides:

```
**Test cases:**
- ✅ Positive: given [input], expects [output]
- ❌ Negative: given [invalid input], raises [error]

**Implementation:** [what to build — file path, class, method]
```

A task marked `Verification: none` must never be routed to this skill - the coordinator dispatches it without TDD.

---

## GATE 0: Load Context

Read project context:
- Test file conventions (location, naming)
- Test framework
- Existing patterns (fixtures, factories, assertions)

Tool-assisted discovery:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`

Using the search tools above: find existing tests to avoid duplication, understand blast radius to prioritize edge cases.

Identify test file path per project conventions.

**Cannot proceed without understanding project test conventions.**

---

## GATE 1: Write Tests

Write **exactly one test per ✅ bullet**, using the project's test framework and the conventions from GATE 0.

Add an unlisted edge-case test ONLY when its absence would let a real production bug through - and name that bug in the test's name or docstring. Otherwise do not add it.

**Negative tests (❌ bullets):** Write when real value exists. Skip if no meaningful failure modes.

**Cannot proceed until every ✅ bullet has corresponding test.**

---

## GATE 2: Verify RED

Inject test command: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`

**Run it yourself, via `Bash`. Do not spawn a `bdk:test-runner` agent for this.** One test file's worth of output is a few lines; a spawn costs a cold start, a preload, and a model round-trip — an order of magnitude more wall-clock than the run it wraps, paid twice per task (RED and GREEN) and again on every fix attempt. `bdk:test-runner` exists to keep a *large* run's output out of a caller's context (group verification, the end-of-plan gate). This is not that.

Pick the command from the injected blocks: the tier matching the test cases you just wrote, `scoped` form, substituting `{files}` with `{test_file_path}`. **Never the `full` form of any tier.**

If that tier has no `scoped` form, derive one from `full` — append `-- {test_file_path}` for an npm/yarn/pnpm script, or a bare path for most direct runners — and note in your report that you derived it, so the settings get fixed once instead of re-derived every run. Only if no scoped form is derivable at all: stop and return `Status: BLOCKED` rather than defaulting to a full run. The coordinator's end-of-plan gate is the only place a full suite runs.

Record the exact command you ran; GATE 4 re-runs the same one.

**Tests PASS:** Stop. Implementation already exists or test wrong.

**Tests FAIL as expected:** Proceed to GATE 3. ✓

---

## GATE 3: Implement

Implement per plan task. Focused on passing tests — no extra features.

---

## GATE 4: Verify GREEN

Re-run the **same scoped command** from GATE 2 via `Bash`. Expect: ALL tests PASS. Still no agent spawn — same reasoning as GATE 2, and now the cost would be paid once per fix attempt.

**Tests FAIL:** Fix implementation, re-run the same command. Max 3 attempts. After 3, stop and ask user.

**Tests PASS:** Proceed. ✓

Do **not** widen the scope on the way out — no full suite, no other tier, no "while I'm here" sweep. Whoever called you owns the wider checks: the coordinator schedules group verification, and the end-of-plan gate runs the full suite once.

---

## Anti-Patterns

- ❌ Skipping GATE 2 ("I know it will fail")
- ❌ Writing implementation before tests exist
- ❌ Forcing negative test when no real failure mode exists
- ❌ Hardcoding test commands — always detect project's test runner
- ❌ Spawning `bdk:test-runner` (or any agent) for a GATE 2/4 run. The spawn costs more wall-clock than the run; use `Bash` directly
- ❌ Falling back to a bare full-suite command (any tier) in GATE 2/4 because scoping "wasn't obvious" — escalate as `BLOCKED` instead; full-suite runs belong only to the coordinator's end-of-plan gate
- ❌ Running an e2e/integration tier in GATE 2/4 for tests that are not e2e specs. Run the tier your new tests belong to, nothing else
- ❌ Padding GATE 1 with boundary/edge tests the spec never asked for and no real bug motivates