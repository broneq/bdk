# Your first feature

One feature carried from intent to a mergeable branch:
**users log in with a one-time link**. It is a `small` Change, the default:
a design, a plan, execution, a review and the close, six commands in all.

Every stage writes its result into the Change and ends by naming the next
command. You can close the session after any stage and continue in a fresh one.

Before you start, [`/bdk:setup`](setup.md) has written the project's test and
lint commands.

## 1. Open the Change

```
/bdk:change "Users log in with a one-time link"
```

`/bdk:change` asks whether to work on a new branch (`feat/one-time-link-login`)
or the current one, then opens the Change with `bdk change new`. It reads the
code the intent touches to pick the profile; a login flow changes user-visible
behaviour, so it stays `small`. It reports the Change id, the branch and the
next command, `/bdk:design`.

The Change is now a directory, committed with your work:

```
.bdk/changes/2026-10-06-users-log-in-with-a-one-time-link/
├── change.md      # the intent, kind and profile
└── log/           # one file per ledger entry
```

At any point, `bdk change status` shows where it stands:

```
2026-10-06-users-log-in-with-a-one-time-link (feature, user)
stage: intent
profile: small
nodes:
  intent done
  design ready
  architecture blocked: design is ready, not done
  ...
gate:design: not ready
gate:review: not ready
```

## 2. Design

```
/bdk:design
```

The skill reads the code first and tells you what exists, then asks about each
real decision with at least two approaches, each with a Mermaid diagram and a
self-critique. With Lavish installed, the comparisons open as a page in your
browser. It writes `design.md` and `architecture.md`, and records every
decision you take as a `decision` entry and every open point as a `question`.

It then runs `/bdk:verify-design`: an Opus agent that knows only its dispatch
package checks every claim the design makes about the code. The skill corrects
false claims itself and shows you the design with the verdict.

**Before continuing:** read the design and the open questions. The design gate
is yours: the Change waits until you type the next command.

## 3. Plan

```
/bdk:plan
```

Typing it passes the design gate; the hook that sees the command refuses it,
naming what is missing, if the design is not done and verified. The skill
writes plan parts under `plan/parts/`, each at most 8 tasks. Every task is a
contract: its goal, its `Files:` and test cases that name an input and the
expected result. A part that changes a living spec gets a spec delta under
`spec-delta/`. It runs `/bdk:verify-plan`, corrects the plan until the verdict
passes and reports the parts and their waves.

**Before continuing:** read the test cases. They are what the implementers
will make pass.

## 4. Execute

```
/bdk:execute
```

The skill never edits a file itself. For each task it opens a ticket, builds a
dispatch package and starts a `bdk:worker` agent with it; after the
implementer, the same ticket runs the simplifier and a `bdk:runner` agent that
runs the tests related to the task's files and the scoped lint, recording each
result as evidence. The kernel closes the ticket only on fresh, passing
evidence, and the task becomes one commit:

```
Store the login token

BDK-Change: 2026-10-06-users-log-in-with-a-one-time-link
BDK-Part: 01
BDK-Task: 01-1
```

A task that fails is retried in a narrowing scope, then once on a stronger
model; after that the kernel parks the Change and asks you. When every part is
done, the skill reports the commits and the open findings and names `/bdk:cr`.

## 5. Review

```
/bdk:cr
```

The review runs in rounds. In each round, a reviewer per group of files and an
Opus integration reviewer over everything read the diff, while a runner runs
the full test and lint suite once against the whole Change. Every finding is
triaged: `blocker`, `should-fix`, `nice-to-have` or `not-a-problem`. Blockers
are fixed in the next round by an implementer. When no blocker is left, the
report opens, and you decide each open entry: fix, defer, reject or track it in
your issue tracker. See [Code review](../workflows/code-review.md).

## 6. Close

```
/bdk:close
```

Typing it passes the review gate. The kernel merges the spec deltas into
`.bdk/specs/`, moves the Change to `.bdk/changes/archive/`, and commits both as
`chore(bdk): close <id>`. The skill prints the PR summary from the ledger: the
intent, the decisions, the assumptions, the risks and the open findings. It
opens no PR: push the branch and open it with that summary.

## The same, without typing each command

```
/bdk:run "Users log in with a one-time link"
```

`/bdk:run` starts each stage the kernel names. It asks nothing: each stage takes
the option it recommends and records it as a decision marked for review, shown
to you at the next gate. It stops at each gate and names the command to type.
`/bdk:run --auto` passes the gates too.

## Next step

Most changes are smaller or larger than this one; see the
[`tiny`](../workflows/tiny.md) and [`large`](../workflows/large.md) workflows.
