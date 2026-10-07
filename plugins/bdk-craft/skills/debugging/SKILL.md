---
name: debugging
description: Root-cause debugging - reproduce the bug as a failing test before touching the code, rank hypotheses by evidence, fix the cause, keep the test, and search for the same defect elsewhere. Load it before reading or editing code for any bug report, error, stack trace, wrong result, flaky test or "it worked yesterday".
license: MIT
---

# Debugging

A fix made before the bug has been seen failing is a guess: it may move the symptom, and nothing proves it worked. Work in this order and do not edit the suspect code before step 2 is done.

## 1. Pin the symptom

Write down, before reading the code in depth:

- **Expected:** what should happen, for a concrete input.
- **Actual:** what happens instead: the wrong value, the exact error text.
- **Scope:** which inputs, since when, where. "Always", "only for X" and "since change Y" are different bugs.

If the report has no concrete input, derive one from the description (for example "quantity 0", "40 items, page 2") or ask for it.

**Done when:** you have one concrete input with an expected and an actual result.

## 2. Reproduce it as a failing test

Add the smallest automated test that shows the symptom, in the project's test files and runner, at the lowest level that still fails. Then run it on its own, in a separate step, and read the failure before you write any part of the fix. Writing the test and the fix together, or running the test only after the fix, skips the proof that the test catches the bug.

- It must fail with the symptom from step 1, not with a setup error.
- Shrink the input while it still fails; what is left is the trigger.
- For a flaky failure, run it in a loop and record the failure rate and what differs between runs.
- If you cannot make it fail, say so and list what you tried. Do not change code for a bug you have not seen fail.

**Done when:** a test run shows this test failing for the reported reason, and you have not yet changed the code under suspicion.

## 3. Rank hypotheses

List every plausible cause with evidence for, evidence against, and one check that confirms or kills it:

```text
H1 `qty || 1` treats 0 as missing - for: fails only for qty 0 - check: qty 0 vs qty undefined
H2 rounding of the total - against: integer prices fail too - dropped
```

Run the cheapest check that separates the most hypotheses. When reading stops converging, halve the search space: `git bisect run <test command>` for "worked before", half the input for a large payload, an assertion at the midpoint of a pipeline.

**Done when:** one hypothesis explains every observation, including the scope, and the others are dropped with a reason.

## 4. State the root cause

One sentence: `<what is wrong>` because `<mechanism>`, introduced by `<change or assumption>`. "The value is null" is a symptom; the cause says why it is null.

**Done when:** the sentence explains the input, the wrong result and the scope.

## 5. Fix the cause

- Change the code where the cause is, not where the symptom shows. A default value, a try/catch or a retry around the failing line hides the bug.
- Make the smallest change that turns the reproduction green; refactoring is a separate step.
- Run the reproduction test, then the rest of the suite.

**Done when:** the reproduction passes, it failed before the fix, and the suite passes.

## 6. Search for the same defect

The mistake that caused this bug was made by a person with a habit. Search the codebase for the same construct and the same assumption (`grep` for the expression, other callers of the function, copies of the logic). Fix each instance that is in scope, with a test; report the others.

**Done when:** you searched, and every match is fixed or named in the report.

## Report

```text
Symptom:         expected vs actual, with the input
Reproduction:    <test> in <file> - failed: <message> - passes after the fix
Root cause:      <the sentence from step 4>
Fix:             <file> - <what changed>
Same defect:     <other places, fixed or reported, or "none found">
```

## Anti-patterns

- Editing the code to see whether the symptom goes away.
- Writing the test after the fix, so it never failed.
- Deleting or loosening a failing test.
- Stopping at the first plausible cause without checking that it explains the whole scope.
