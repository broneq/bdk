---
name: debugging
description: Root-cause debugging - reproduce as a failing test, rank hypotheses by evidence, narrow by bisection, fix the cause and keep the regression test. Use for an error, a traceback, a wrong result, a flaky test or a "worked yesterday" report.
license: MIT
---

# Debugging

A fix made before the cause is known moves the bug instead of removing it. This skill fixes the order: evidence first, then a reproduction that fails, then the cause, then the fix, with the reproduction kept as the regression test.

## 1. Pin the symptom

Write down, before reading any code:

- **Expected:** what should happen, with a concrete input.
- **Actual:** what happens instead: the exact error text, the wrong value, the stack frame that throws.
- **Scope:** since when, for which inputs, in which environment. "Always", "only for X" and "since commit Y" are three different bugs.

If the report lacks a concrete input or the actual output, get it first: from the user, the logs or a run. Do not guess a symptom.

## 2. Reproduce as a failing test

Turn the symptom into the smallest automated check that fails today:

- Prefer a unit test at the lowest level that still shows the bug. Climb to an integration test only when the bug lives between components.
- Shrink the input. Remove fields, lines and steps one at a time while the test still fails; what remains is the bug's real trigger.
- Run the test and record the failure message. It must fail with the symptom from step 1, not with a setup error.
- For a flaky failure, run it in a loop until it fails, and record the failure rate and what differs between runs (order, time, shared state, concurrency).

If you cannot reproduce it, say so and list what you tried. Do not change code to fix a bug you have not seen fail.

## 3. Rank hypotheses

List every plausible cause, then rank the list by evidence, not by intuition:

```text
Hypotheses
H1 date parsed in local time, not UTC - for: fails only for UTC+ zones; against: none yet - check: run the test with TZ=UTC
H2 cache returns a stale entry - for: none; against: fails with an empty cache - dropped
H3 off-by-one at the month boundary - for: fails on the 1st only; against: - check: add a 2nd-of-month case
```

- Every hypothesis has evidence for, evidence against, and one check that would confirm or kill it.
- Run the cheapest check that splits the most hypotheses first.
- Kill hypotheses explicitly. A hypothesis that survives every check without evidence for it is not the cause.

## 4. Narrow by bisection

When reading code stops converging, halve the search space mechanically:

| Search space                                 | How to halve it                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| History: it worked at an older commit        | `git bisect` with the failing test as the check (`git bisect run <test command>`)             |
| Input: a large payload or file triggers it   | Cut the input in half and keep the half that still fails                                      |
| Code path: a long pipeline                   | Assert the intermediate value at the midpoint; the bug is on the side where it is first wrong |
| Configuration: works in one environment only | Copy settings from the working one, half at a time                                            |

Stop when one change, one input element or one line explains the failure.

## 5. State the root cause

Write one sentence of the form:

> `<what is wrong>` because `<mechanism>`, introduced by `<change or assumption>`.

- It must explain every observation from steps 1 to 4, including the scope.
- "The value is null" is a symptom. "The value is null because the loader returns before the promise resolves, introduced when the loader became async" is a cause.
- Ask why once more. If the answer names a design flaw that will produce more bugs of the same class, say so; that is a separate change.

## 6. Fix the cause and verify

- Change the code at the cause, not where the symptom shows. A null check where the value is read hides the bug; the loader is what needs fixing.
- Make the smallest change that turns the reproduction test green. Leave refactoring for a separate step.
- Run the reproduction test, then the tests around the changed code.
- Search for the same pattern elsewhere: the same call, the same assumption. Report each place found; fix those that are in scope.

## Report

End with this summary:

```text
Debug report
Symptom:          <expected vs actual, with the input>
Reproduction:     <test name> in <file> - failed: <message>
Hypotheses:       <n> considered; kept H<k>, dropped <the others with the reason>
Root cause:       <the sentence from step 5>
Fix:              <file>:<lines> - <what changed>
Regression test:  <test name> - passes; it failed before the fix
Same pattern:     <other places found, or none>
```

## Anti-patterns

- Changing code to see whether the symptom goes away. That is a check without a hypothesis; if it works, you do not know why.
- Fixing at the symptom: a try/catch, a default value or a retry around the failing line.
- Deleting or loosening the failing test.
- Stopping at the first plausible cause without checking that it explains the whole scope.
- Adding logging everywhere at once. Add it at the midpoint of the search space, then halve.
