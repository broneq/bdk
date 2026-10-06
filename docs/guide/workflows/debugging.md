# Debugging

BDK has no debugging stage. A bug is fixed as a bug Change, and the debugging process itself comes from the `debugging` skill of the separate `bdk-craft` plugin. You can also run that skill on its own, outside any Change.

## Install the craft skills

```
/plugin install bdk-craft@bdk
```

`bdk-craft` comes from the same marketplace as `bdk` and works without it. Without `bdk-craft`, a bug Change runs as usual, but its implementers get no debugging process.

## Fix a bug as a Change

Describe the defect to `/bdk:change`:

```
/bdk:change The date filter shows entries of the previous evening for users in New York
```

`/bdk:change` opens a Change of kind `bug` when the intent reports a defect: something that worked, or should work, and does not. A bug Change skips the design stage and goes straight to `/bdk:plan`, then `/bdk:execute` and `/bdk:cr`, as in [a small Change](small.md). `/bdk:run` carries it through these stages for you.

With `bdk-craft` installed, every implementer package of a bug Change has a `Craft` section that names two skills, `debugging` and then `tdd`, and the command that prints each one:

```
## Craft

- `debugging`: `bdk ctx craft debugging`
- `tdd`: `bdk ctx craft tdd`
```

The implementer prints both before its first edit and follows them. It reproduces the symptom as a failing test, weighs the candidate causes, fixes the cause, and keeps the test as a regression test. A feature Change names `tdd` only.

## Debug without a Change

`/bdk-craft:debugging` runs the same process in your session, on any repository:

```
/bdk-craft:debugging <the symptom, an error message, or the steps to reproduce>
```

It opens no Change and writes nothing under `.bdk/`. It ends with a debug report: the symptom, the reproduction, the hypotheses kept and dropped, the root cause, the fix and the regression test. When the fix turns out to need a plan or a review, open a bug Change with that report as its intent.

## The process

| Step                 | What it produces                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Pin the symptom      | expected and actual, with the input, and since when it happens                                  |
| Reproduce            | a failing test that fails with the symptom, not with a setup error                              |
| Rank hypotheses      | every plausible cause with evidence for and against it, and the check that confirms or kills it |
| Narrow by bisection  | the first bad commit, input or step, when the hypotheses do not settle it                       |
| State the root cause | one sentence that explains every observation, including the scope                               |
| Fix and verify       | the fix at the cause, the regression test green, and the same pattern searched elsewhere        |

## Next step

A bug Change ends with [Code review](code-review.md), like any other Change.
