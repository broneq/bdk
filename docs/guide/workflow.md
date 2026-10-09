# From an idea to a pull request - one Change, stage by stage

A piece of work in BDK is an [OpenSpec Change](/concepts/openspec-changes): a directory under `openspec/changes/<change>/` that says why and what (proposal), what the product does afterwards (spec deltas with scenarios), how (design) and in which parts it is built (plan). Its run state lives under `.bdk/runs/<change>/`. This page takes one Change through every stage. Each stage ends with a short report that names the next command.

The example adds a CSV export to a web app.

## Propose

```text
/bdk:propose "users can export the order list as CSV"
```

You can also start from a GitHub issue: `/bdk:propose #42` or its URL. BDK opens the Change and writes `proposal.md`: why, what changes, which capabilities of `openspec/specs/` it touches, and what is out of scope. When two readings of the intent would change the scope, it asks you first.

Read `proposal.md`. If it is wrong, say what to change, or edit it yourself.

## Design

```text
/bdk:design add-csv-export
```

Three blocks run in turn: `/bdk:explore` maps the code the Change touches, `/bdk:design-draft` writes the spec deltas and `design.md` (it asks you about decisions the code and the proposal do not settle), and `/bdk:verify-design` checks them against the proposal and the code on the `bdk:verifier` agent. A failing check sends the draft back, at most `policy.budgets.verifier` times (3).

Then the **design gate**: BDK asks you to approve the design, naming the files to read. Approve, or ask for changes and the draft runs again with your request. With `policy.gates.design: auto` the gate approves by itself. This is the one gate before the build: the plan has no gate of its own, its verifier checks it.

## Plan

```text
/bdk:plan add-csv-export
```

`/bdk:plan-draft` cuts the work into parts, `plan/parts/01.md`, `02.md`, ..., each small enough for one agent, with the files it touches, the spec scenarios it makes true and its tasks. `/bdk:verify-plan` checks the plan; `bdk plan check` checks part sizes and dependencies, and computes the waves. The plan stays uncommitted for you to read: [how a plan is cut](/concepts/stages#how-a-plan-is-cut) explains parts, waves, `depends-on` and `isolation`, what to look for in a part file, and what each problem of `bdk plan check` means.

**Put the Change on its own branch and commit its files now**: the build starts only from a clean tree, and the Change's commits never go to your base branch.

```text
git switch -c add-csv-export
/bdk:commit
```

`/bdk:commit` writes the commit message in your project's convention. When you skip the branch, `/bdk:execute` creates one named after the Change, but your commit of the Change files would stay on the base branch. `/bdk:run` does all of this for you.

## Execute

```text
/bdk:execute add-csv-export
```

One lead agent builds the plan in waves: parts that do not depend on each other run in parallel, each in its own git worktree, each written test-first by `bdk:implementer` and then checked against its scenarios by `bdk:conformer`, which runs your test, lint and build commands. The lead commits each part and merges it into the Change's branch. By default the lead runs in the background and Claude tells you when it is done; `.bdk/runs/add-csv-export/execute/result.md` holds the result.

A part that still fails after `policy.budgets.part-attempts` runs (3, the last one on `policy.escalation.model` and `policy.escalation.effort`) is reported as blocked, with the evidence. Fix the cause, then let BDK retry.

## Review

```text
/bdk:auto-review add-csv-export
```

A review round runs in parallel:

- reviewers read the diff, group by group, and an integration reviewer reads it as a whole;
- your test, lint and build commands run;
- the [E2E check](/concepts/e2e) starts your product and drives every spec scenario of the Change as a user would.

A judge sets a level on each [finding](/concepts/findings) (`blocker`, `should-fix`, `nice-to-have`, `not-a-problem`), and then you **triage**: for each finding, fix, accept or defer it (optionally with a GitHub issue). BDK shows a page with every finding and its recommended decision preselected, or asks in the terminal. With `policy.gates.review: auto` the recommendations are taken without asking.

Findings marked `fix` become fix parts, built like any other part; the next round reviews only those fixes. The review ends when a round leaves nothing to fix, or after `policy.budgets.review-rounds` rounds (3). The summary is in `.bdk/runs/add-csv-export/review/result.md`.

## Close

```text
/bdk:close add-csv-export
```

BDK commits what is left, checks that the product matches the spec deltas (`/bdk:spec-conformance`), archives the Change, which merges its deltas into `openspec/specs/`, pushes the branch and opens a pull request into the base branch (`--base <branch>` to choose it). If the specs and the product disagree, it stops before the archive and says where.

You review and merge the pull request.

## Let BDK run the whole way: `/bdk:run`

```text
/bdk:run "users can export the order list as CSV"
/bdk:run #42 #43 #44
```

`/bdk:run` builds a queue of Changes (from an intent, or from issues, in the order their "blocked by" links allow) and runs the same stages for each, on its own branch, committing the Change files before the build. It stops whenever a stage needs you: a gate, a question, a blocked part, a spent budget. Run `/bdk:run` with no arguments to continue where it stopped. The final report lists the pull requests and every decision taken without you.

How far it goes without you depends on [gates and budgets](/concepts/gates-and-budgets). With the defaults it stops at every design gate and every triage.

## When something stops

Every stage writes its progress to files and starts at its first missing file. After a break, a stop for your decision or a crash, run the same command again: it continues. `bdk run status` (ask Claude to run it) shows the open stage of each Change and why it is open; `/bdk:<stage> <change>` continues it. The files of each stage are listed in [run state](/concepts/run-state).

## Other entry points

- **A bug:** `/bdk:debug "<what is broken>"` or `/bdk:debug #57`. BDK reproduces the bug on the running product, writes a one-part fix Change, asks you at the fix gate (`policy.gates.design`), builds and reviews it. Close it with `/bdk:close`.
- **Any pull request:** `/bdk:pr-review 123` reviews an open pull request, BDK's or anyone's, with the same group and integration reviewers and the same judge, and posts one GitHub review after you agree. Several at once: `/bdk:pr-review 7 8` reviews them in parallel and asks you once for all. After the author answered: `/bdk:pr-review --verify 7` checks each `blocker` and `should-fix` finding of your previous review at the new head, reviews the commits pushed since that review, resolves the threads of the fixed findings and posts what is left and what is new.
- **One block alone:** every block is a skill you can run by itself, for example `/bdk:e2e-check add-csv-export` to check the product against the Change's scenarios, or `/bdk:adr` to record a decision. The [skills reference](/reference/bdk/skills) lists them all.
