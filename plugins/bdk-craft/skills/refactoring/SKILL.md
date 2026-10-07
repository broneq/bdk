---
name: refactoring
description: Safe refactoring - pin today's behaviour with characterisation tests before the first edit, change structure in small named steps with the tests run after each, and report odd behaviour instead of silently fixing it. Load it before editing when asked to clean up, refactor, restructure, simplify or make code readable or maintainable.
license: MIT
---

# Refactoring

Refactoring changes structure, never behaviour. It goes wrong when the behaviour was never pinned down, when many changes land at once, or when a "small fix" slips in on the way. Do not edit the code under refactoring before step 1 is done.

## 1. Pin today's behaviour

Run the tests that cover the code. If there are none, or they miss branches you will touch, write **characterisation tests** in a test file first:

- Read every conditional and give each branch an input, plus the boundaries (exactly at a threshold, empty, missing, the longest value).
- Assert what the code returns **today**, even where today's answer looks wrong. A characterisation test pins current behaviour, not intended behaviour.
- Run them and see them pass against the untouched code.

**Done when:** every branch you will move has a passing test, and the code under refactoring is still unchanged.

## 2. Name the smells and the refactorings

List what makes the code hard to read and the catalogue refactoring that removes it:

| Smell | Refactoring |
| --- | --- |
| Long function, a comment explaining a block | Extract Function |
| Nested conditionals | Replace Nested Conditional with Guard Clauses |
| Magic number or string | Replace Magic Literal with a named constant |
| Unclear name | Rename Variable / Function |
| Same switch on a type in several places | Replace Conditional with Polymorphism or a lookup table |
| Loop doing two things | Split Loop |
| Flag argument | Remove Flag Argument |
| Same fields passed together | Introduce Parameter Object |
| `var`, loose `==`, string concatenation | Modernise one construct at a time, only where it cannot change results |

**Done when:** each smell has one named refactoring, in the order you will apply them.

## 3. Move in small steps, tests after each

For each refactoring: apply exactly one, run the tests, and keep it only if they pass; otherwise undo and take a smaller step.

- No behaviour change inside a step: no bug fix, no new feature, no changed message, no reordered side effect. Watch the traps: `==` to `===`, `>` to `>=`, `||` to `??`, and rounding are behaviour changes unless the tests prove otherwise.
- Never change a test's assertions during a refactoring.

**Done when:** each refactoring from step 2 was applied on its own and followed by a passing test run.

## 4. Report what you kept

Anything that looked wrong but is today's behaviour (a boundary that disagrees with the docs, unescaped output, a rule that cuts information) stays as it is. Name it in the reply as a separate decision for the user, with the test that pins it.

**Done when:** the reply lists the steps in order, the test runs, and every suspicious behaviour you preserved.

## Anti-patterns

- Refactoring without a safety net because "it only moves code".
- A rewrite presented as a refactoring.
- Fixing a bug in the middle of a refactoring, even a real one.
- Refactoring code nobody asked to change.
