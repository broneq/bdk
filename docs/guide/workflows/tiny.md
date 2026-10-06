# Tiny changes

A `tiny` Change is the shortest path through the pipeline: no design, no
verification of the plan, straight from the intent to a plan, its execution, the
review and the close.

```
/bdk:change "<intent>"  ->  /bdk:plan  ->  /bdk:execute  ->  /bdk:cr  ->  /bdk:close
```

## When a Change is tiny

`/bdk:change` opens a Change `tiny` only when the code the intent touches shows
all of these:

- no user-visible behaviour change;
- no data model, schema or configuration change;
- no change to a capability a living spec describes;
- at most 2 files in 1 module.

Anything else opens `small`. The skill states the reason, and the kernel keeps
it in the ledger as the profile assumption, so the reviewer sees why the design
was skipped.

## The stages

1. **`/bdk:change "Rename the retry constant"`** opens the Change and names
   `/bdk:plan`. There is no design gate to pass.
2. **`/bdk:plan`** writes one plan part, usually one task, with its test cases
   or `Verification: none` for a task that touches only non-executable files.
   The plan is not verified by a separate agent.
3. **`/bdk:execute`** builds the task through an implementer, the simplifier
   and the runner, and commits it with its trailers.
4. **`/bdk:cr`** reviews the Change and runs the full test and lint suite once.
5. **`/bdk:close`** passes the review gate, archives the Change and prints the
   PR summary.

`/bdk:run "<intent>"` does the same without you typing each stage, and stops at
the review gate.

## When it outgrows tiny

The kernel measures what the Change actually committed. When `bdk commit` or
`bdk part done` finds more than 2 files, more than 1 module or more than 50
lines, it records a finding for the review gate, so the reviewer and you see
that the assumption no longer holds.

To give the rest of the work a design, raise the profile; it never goes down:

```sh
bdk change resume <id> --profile small
```

## Without a Change at all

An edit you make yourself in the session needs no Change. BDK's foundation is
in every session, so the proportionality rule and the capture conventions
apply anyway. When you want it reviewed, run `/bdk:cr`: on a branch without a
Change it opens a review Change of the branch and reviews it like any other.
See [Code review](code-review.md).
