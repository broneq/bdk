---
name: tdd
description: Test-driven development as a strict red-green-refactor loop, one behaviour at a time, with a failing test run seen before each piece of code. Load it before writing any code when the user asks to work test-first, TDD or "tests first", for a new function, a feature or a bug fix with a known cause.
license: MIT
---

# Test-driven development

A test that never failed proves nothing, and code written before its test is shaped by the implementation instead of the requirement. Run the loop below one behaviour at a time; never write a batch of tests followed by a batch of code.

## 1. Write the test list

Before any file, list the behaviours the request needs, one observable outcome per line, simplest first (empty or degenerate input first):

```text
Test list
- [ ] empty title gives an empty slug
- [ ] words are lowercased and joined with single hyphens
- [ ] Polish letters are folded to ASCII
- [ ] no leading or trailing hyphen
- [ ] long titles stop at 60 characters on a word boundary
```

Find the project's test runner and conventions first (`package.json` scripts, neighbouring test files) and use them.

**Done when:** every requirement in the request maps to at least one line, and you know the exact command that runs one test file.

## 2. Red: one test, run it, see it fail

Create or extend the test file with exactly one test for the next unchecked line. Create the test file before the implementation file. Run the narrowest command that covers it.

- The failure must be the missing behaviour: an assertion about the expected value, or a missing export. A syntax error, a wrong import path or a broken fixture is not a valid red; fix it and run again.
- If the new test passes at once, it tests nothing new. Rewrite it or drop the line.

**Done when:** you ran the test and read an assertion failure for this behaviour.

## 3. Green: the least code that passes

Write only what the failing test demands, then run the same command again.

- Fake it (return a constant) for the first test of a behaviour; triangulate with the next test; write the obvious implementation when it is small and clear.
- Every test in the file passes, not only the new one.
- Three failed attempts at the same test mean the test or the design is wrong: stop and say so.

**Done when:** the run shows every test passing.

## 4. Refactor while green

Remove duplication and improve names in code and tests. Run the tests after each change. Add no behaviour here; new behaviour needs a new red test.

**Done when:** the tests pass after the last refactoring, and the line is ticked. Go back to step 2 for the next line.

## 5. Finish

Run the whole test file (or the project's test command) once more, then report the list of behaviours with the failure you saw for each before it passed, and the command you used.

**Done when:** every line of the list is ticked, each with a red run recorded before its green run, and the final run passes.

## Rules for every test

- The title is a sentence about behaviour: `folds Polish letters to ASCII`.
- It asserts outputs and observable effects, never private state or the calls between internal functions.
- It fails if the behaviour breaks. Asserting that a value exists, or a constant against itself, is not a test.
- It builds its own data; no shared mutable fixtures.
- Mock only interfaces the project owns. Wrap a third-party client in a small adapter and replace the adapter.

## Anti-patterns

- All tests first, then all code: no single failure drives a single change.
- Code first, then a test that passes on its first run.
- Weakening an assertion to get to green.
- Refactoring while a test is red.
