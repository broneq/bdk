# Proposal

## Why

Tracks #307.

The execute diagrams in `docs/concepts/orchestrators.md` show implement, conform, commit and merge, but not where the tests and the other checks run. A reader asked "when are the tests of what we built run? In conform?" and could not tell from the page. The Guide adds to the confusion: it says the conformer runs the test, lint and build commands, while the implementer runs them first. Nothing says that the merged result of a wave is not checked before `/bdk:auto-review`.

## What Changes

- `docs/concepts/orchestrators.md`: the part diagram shows the red acceptance tests, the part checks with their three runs, and the conform checks with the undo of a fix that turns a check red; the merge diagram shows the checks of `/bdk:resolve-conflict`. A table lists every check run of the execute stage (who runs it, its id, kinds, scope, what happens on red), and the text says which files a scoped check covers and that a merged wave is not checked before `/bdk:auto-review`.
- `docs/concepts/stages.md` (Execute) and `docs/guide/workflow.md` (Execute): a sentence on when the tests run, linking to that table; the Guide no longer says the conformer is the one that runs the checks.
- `docs/concepts/gates-and-budgets.md`: the three check runs inside one implementer run are told apart from `policy.budgets.part-attempts`.
- No skill, agent, CLI or settings change: the docs describe the skills as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: the Concepts show every check run of the execute stage and what it leaves unchecked.

## Impact

- User docs: `docs/concepts/orchestrators.md`, `docs/concepts/stages.md`, `docs/concepts/gates-and-budgets.md`, `docs/guide/workflow.md`, and one clause in `docs/guide/configuration.md` ("When a part keeps failing"). The Reference does not change (nothing it is generated from changes).
- Code: none.
- Not in scope: a one-part wave in the main checkout (#306), which changes the execute-waves diagram of the same page; whichever lands second merges the other's text.
