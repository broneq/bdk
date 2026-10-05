---
name: tdd
description: Test-driven development as a gated red-green-refactor loop with a written test list and an observed failure before every change. Use when adding a feature, fixing a bug with a known cause, or changing behaviour test-first.
license: MIT
---

# Test-driven development

Code written before its test is shaped by the implementation, and a test that never failed proves nothing. This skill fixes the order and makes every step visible, so a reviewer can check that each test failed for the right reason before the code that makes it pass existed.

## The loop

Work through four gates for each behaviour. Do not skip a gate and do not batch behaviours.

### Gate 0: the test list

Before touching code, write the list of behaviours the change needs, one line each, as sentences about observable outcomes:

```text
Test list
- [ ] returns 0 for an empty cart
- [ ] sums the line totals of a cart
- [ ] rejects a negative quantity with a validation error
```

- One line is one behaviour, not one function. "handles input" is not a behaviour; "rejects a negative quantity with a validation error" is.
- Order the list from the simplest case to the hardest. The degenerate case (empty, zero, missing) comes first.
- Find the project's test conventions first: where tests live, how they are named, which helpers and fixtures exist. Read two neighbouring tests and copy their shape.
- New ideas found during the work go onto the list. They do not go into the code you are writing now.

### Gate 1: red

Pick the next unchecked line. Write exactly one test for it, then run only that test file.

- The test must fail, and it must fail for the reason the behaviour is missing: an assertion about the expected value, or a missing function. A syntax error, a wrong import path or a broken fixture is not a valid red; fix it and run again.
- If the test passes at once, stop. Either the behaviour already exists (delete the line or the test) or the test asserts nothing that matters (rewrite it).
- Copy the decisive failure line into the log. "It fails" is not evidence; the assertion message is.

### Gate 2: green

Write the least code that makes the failing test pass, then run the same test file again.

Choose one of three moves on purpose:

| Move                   | When                                                         | Example                                |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------- |
| Fake it                | The first test of a behaviour, or the way forward is unclear | `return 0`                             |
| Triangulate            | A second test with a different input forces the general form | the sum test after the empty-cart test |
| Obvious implementation | The general form is clear and small                          | a one-line `reduce`                    |

- Every test in the file must pass, not only the new one.
- Run the narrowest command that covers the file. The full suite belongs at the end of the work, not inside the loop.
- If the same test stays red after three attempts, stop and report what you tried. The test or the design is wrong, and more attempts hide that.

### Gate 3: refactor

With every test green, remove duplication and improve names in both the code and the tests. Run the tests after each refactoring step. Never add behaviour here: new behaviour needs a new red test first.

Then tick the line on the test list and go back to Gate 1.

## What a test must be

- It names the behaviour in its title, written as a sentence: `rejects a negative quantity`.
- It has one reason to fail. Several assertions are fine when they check one outcome.
- It asserts on outputs and observable effects, never on private state or on the exact calls between internal functions.
- It would fail if the behaviour broke. A test that asserts a constant against itself, checks only that a value is not null, or checks only that a function exists is not a test.
- It builds its own data. Shared mutable fixtures make the order of tests matter.

## The log

End the work with the log, in this form, one entry per gate passed. It is the evidence that the loop ran.

```text
TDD log
Test list: 3 behaviours, 3 done
1. RED      returns 0 for an empty cart - failed: expected 0, received undefined
   GREEN    fake it: return 0 - 1 passed
2. RED      sums the line totals of a cart - failed: expected 25, received 0
   GREEN    triangulate: reduce over lines - 2 passed
   REFACTOR extracted lineTotal() - 2 passed
3. RED      rejects a negative quantity - failed: expected error "quantity must be >= 0", none thrown
   GREEN    guard clause - 3 passed
Command: <the exact test command you ran>
```

- Every behaviour has a `RED` line with the failure message, before its `GREEN` line.
- The command is the one you ran, so the reader can repeat it.

## Anti-patterns

- Writing all the tests first, then all the code. That is test-first, not test-driven: no single failure guides a single change.
- Writing the code, then a test that passes on its first run. Nothing proves the test can fail.
- Weakening an assertion to get to green.
- Refactoring while red.
- Mocking the code under test, or mocking a type the project does not own. Wrap a third-party client in a small adapter of your own and replace that in tests.
