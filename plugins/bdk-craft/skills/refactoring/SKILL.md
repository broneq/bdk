---
name: refactoring
description: Safe refactoring in small named steps - characterisation tests first, one catalogue refactoring per step, tests green after each, behaviour changes kept apart. Use when cleaning up, restructuring or simplifying existing code.
license: MIT
---

# Refactoring

Refactoring changes the structure of code without changing what it does. It goes wrong when the behaviour was never pinned down, when many changes land at once, or when a "small fix" slips in on the way. This skill fixes the process: pin the behaviour, then move in named steps that are each checked.

## 1. Pin the behaviour

Before the first change, the code under refactoring must be covered by tests that would notice a change in behaviour.

- Run the existing tests that cover the code. If none exist, or they miss paths you will touch, write **characterisation tests**: call the code with representative inputs, including the edge cases you can see in the branches, and assert what it returns today, even when today's answer looks wrong.
- A characterisation test asserts the current behaviour, not the intended one. A suspected bug gets a note and a separate change, never a silent fix inside the refactoring.
- Cover every branch you will move. Read the conditionals and give each one an input.
- Run the tests and see them pass before you change anything.

## 2. Name the smells

List what is wrong with the code, using the standard names, and pick the refactoring that removes each smell:

| Smell                                                     | Refactoring                                      |
| --------------------------------------------------------- | ------------------------------------------------ |
| Long function                                             | Extract Function                                 |
| Duplicated code                                           | Extract Function, then call it from both places  |
| Unclear name                                              | Rename Variable / Rename Function                |
| Long parameter list                                       | Introduce Parameter Object                       |
| A conditional that switches on a type, repeated           | Replace Conditional with Polymorphism            |
| Nested conditionals                                       | Replace Nested Conditional with Guard Clauses    |
| A comment explaining a block                              | Extract Function named after the comment         |
| Magic number or string                                    | Replace Magic Literal with a named constant      |
| A loop that does two things                               | Split Loop                                       |
| A temporary assigned once and used for a query            | Replace Temp with Query                          |
| A method that uses another class's data more than its own | Move Function                                    |
| Data clump: the same fields always passed together        | Extract Class or Introduce Parameter Object      |
| Flag argument that switches behaviour                     | Remove Flag Argument: one function per behaviour |

## 3. Move in small steps

For each refactoring in the plan:

1. Apply exactly one named refactoring.
2. Run the tests. They pass, or you undo the step and take a smaller one.
3. Record the step in the log.

- One step changes one thing. Extracting a function and renaming its variables are two steps.
- Never change behaviour inside a step: no new feature, no bug fix, no changed error message, no reordered side effect.
- Keep the code compiling and the tests passing after every step. A refactoring that needs ten broken steps before it works again is a rewrite; split it or use Parallel Change (add the new shape, migrate callers one by one, remove the old shape).
- Use the editor's or the language tools' automated refactorings when they exist; they are safer than hand edits.

## 4. Stop

Stop when the smells on the list are gone, or when the next step no longer makes the code you were asked to change easier to read or extend. Leave unrelated code alone.

## The log

End with this log. It lets a reviewer check every step as a pure restructuring.

```text
Refactoring log
Safety net: 6 characterisation tests in <file> - 6 passed before the first step
1. Extract Function: validateLines() from placeOrder() - 6 passed
2. Replace Nested Conditional with Guard Clauses in placeOrder() - 6 passed
3. Rename Variable: tmp -> subtotal - 6 passed
4. Replace Conditional with Polymorphism: shipping cost per carrier - 6 passed
Behaviour changes: none
Noted, not fixed: rounding of the discount looks wrong for 3 decimals (separate change)
Command: <the exact test command you ran>
```

## Anti-patterns

- Refactoring without a safety net, trusting that "it is only moving code".
- A big-bang rewrite presented as a refactoring.
- Fixing a bug in the middle of a refactoring. Even when correct, it hides a behaviour change among structural ones.
- Changing a test's assertions during a refactoring. Tests may be renamed or moved, never made to expect something else.
- Refactoring code nobody asked to change, because it was nearby.
