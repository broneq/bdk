# Small changes

`small` is the default profile, and most features and changes of behaviour are
`small`. The Change gets a design, an independent check of the design and of the
plan, and two gates where you decide.

```
/bdk:change  ->  /bdk:design  ->  [gate]  /bdk:plan  ->  /bdk:execute  ->  /bdk:cr  ->  [gate]  /bdk:close
```

[Your first feature](../getting-started/first-feature.md) walks through one
`small` Change command by command. This page is the reference for what each
stage produces and where you step in.

## What each stage leaves

| Stage          | Writes into `.bdk/changes/<id>/`                                                               | Ends with            |
| -------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| `/bdk:change`  | `change.md`, the profile assumption in `log/`                                                  | names `/bdk:design`  |
| `/bdk:design`  | `design.md` (at most 12 KB), `architecture.md`, decisions and questions, the verifier's report | the design gate      |
| `/bdk:plan`    | `plan/parts/`, `spec-delta/` for each capability a part changes, the verifier's report         | names `/bdk:execute` |
| `/bdk:execute` | tickets, dispatch packages, reports, evidence; one commit per task in the project              | names `/bdk:cr`      |
| `/bdk:cr`      | review rounds, triaged findings, the full test and lint evidence                               | the review gate      |
| `/bdk:close`   | moves the Change to `archive/`, merges `spec-delta/` into `.bdk/specs/`                        | the PR summary       |

A design that needs no module boundary declares `architecture: false` in
`design.md`, and `architecture.md` is skipped.

## Where you step in

- **Design decisions.** `/bdk:design` asks you every real decision, with at
  least two approaches each. A data-model change needs its own approval.
- **The design gate.** Typing `/bdk:plan` accepts the design. If the design is
  not done or its verdict is stale, the hook refuses the command and says what
  is missing.
- **A blocker the plan cannot settle.** `/bdk:plan` and `/bdk:execute` ask you
  only about a decision the design and the ledger do not hold.
- **A parked Change.** When a ladder runs out, the kernel parks the Change with
  a question and its options; `/bdk:change` shows it, and
  `bdk change resume <id> --option <n>` answers it.
- **The review report.** You decide each open finding: fix, defer, reject or
  track.
- **The review gate.** Typing `/bdk:close` accepts the review.

## When it goes sideways

| Symptom                                   | What to do                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The design verifier keeps blocking        | Read the blockers: a false claim about the code is fixed by `/bdk:design`; a real design flaw is your call |
| You edited a design or plan file by hand  | Run `/bdk:verify-design` or `/bdk:verify-plan`; the old verdict is stale                                   |
| The plan turns out to need a design split | `/bdk:design` writes design parts; the kernel raises the Change to `large`                                 |
| A task fails repeatedly                   | Let the ladder run: narrower retries, one escalation, then a question to you                               |
| The session died with tickets open        | `bdk change takeover --close-tickets` in the new session closes them as `not-run` and keeps the budgets    |
| You do not know what comes next           | `bdk next`, or `/bdk:change` with no argument                                                              |

## Gates on autopilot

`/bdk:run` drives the same stages without you typing them. Without `--auto`, it
stops at each gate whose `policy.gates` value is `manual`, the default. With
`--auto`, it passes both, and each pass is recorded as `source: policy` and
listed in the PR summary. Every choice a stage made without you becomes a
decision marked for review, shown at the next gate.
