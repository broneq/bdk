---
name: plan
description: Plans the active BDK Change - writes the plan parts the kernel names as task contracts with concrete test cases, verifies and corrects them, and reports the waves to execute. Use when a Change waits on /bdk:plan.
argument-hint: "[--review] [what to focus on]"
allowed-tools: Bash(bdk *) Bash(echo *) Bash(lavish-axi *) Read Grep Glob Write Edit AskUserQuestion Skill Agent
---

!`bdk ctx skill plan 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: plan" heading appears above, run `bdk ctx skill plan` first and apply its output; on a `BDK STOP` line, stop and report it.

# Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md).

You turn the active Change into plan parts that workers build without you: each task is a contract with test cases, and each part is a unit a lead finishes and commits on its own. The kernel decides what the plan needs and checks its size; you decide what it says and how it splits. Add `--json` to every command whose output you act on. Apply the `Rules: plan`, `Rules: engineering-judgment`, `Rules: test-quality`, language and project rules sections of the BDK context above.

Arguments: $ARGUMENTS. `--review` asks for one review of the verified plan before the report; any other text is a focus the user gives the plan.

Done when the plan is verified (or the Change has no `plan-verify`) and you have given the report, or when the kernel parks the Change. You correct the plan yourself; end your turn earlier only to ask the user a decision the design, the ledger and the code do not hold, or to report a refusal you cannot resolve. A turn that ends with "next I will ..." while the plan is not verified is not done.

## Start

Run `bdk next --json`.

- A refusal because no Change is active (`policy/no-active-change`): write nothing, and name the command of its `instead` (`/bdk:change`).
- An `artifact` of the plan stage (`plan`, `plan-verify`): continue below. The `plan` instruction names the paths and the frontmatter to write.
- Anything else (the design gate, a later stage, a parked Change): report what `next` returns and stop.

## Ground the plan

Before writing, read:

- `bdk change status --json` and the design files of the Change that exist (`design.md`, `architecture.md`, `design/parts/`); a `bug` or `tiny` Change has no design, so plan it from the intent in `change.md`;
- the accepted decisions and the live questions: `bdk log list --type decision --json` and `bdk log list --type question --json`;
- the code every task will touch: the symbols it calls, the callers of what it changes, the tests next to it. For a search across many files you may start the host's read-only search agent. Every signature and path the plan names comes from a file you read.

A live question whose answer changes what a task builds is settled before `bdk done plan`: answer it from the design or the code when they settle it, otherwise ask the user, as the `Asking the user` section of the BDK context says. Record each answer as `bdk log add decision "<answer>" --ref <the question's ref> --body -` and resolve the question with `bdk log resolve <id> resolved --reason "<decision id>"`.

## Write the parts

The intent sets the size of the plan. Plan what the intent and the design ask, at the size they ask for: a fix to one function is one part with one task, which states the corrected behaviour, a case that reproduces the defect, and cases that show the neighbouring behaviour unchanged. Guards in callers, inputs nobody reported and cleanups are not tasks; record each as `bdk log add finding "<what>" --ref <file>`. A task states only the behaviour the Change alters, because every behaviour sentence is one more test case to write and verify.

Scope grows only to keep correct what the Change itself breaks, such as a direct caller whose output the fix changes, and then only by tasks in the parts the plan already has. Growth that would add a part, change a shared data model, or reach modules beyond those direct callers belongs in a follow-up Change: record it as a `finding` and name it in the report. A question about growing the scope names the tasks and files the growth adds and offers, next to it, the option that keeps the plan to the intent with the rest recorded for a follow-up Change.

Split the work into parts a lead can finish and commit on its own: tasks that share files stay in one part, a part names in `depends-on` every part whose output it consumes, and parts without a dependency between them run in the same wave. On a `large` Change the design parts suggest the split, but parts follow what can be built together, not the design's grouping. Parts of one wave share one working tree, so decide `isolation` for each part that can share a wave: `worktree`, with an `isolation-reason` naming the state, when it touches state outside its `Files:` that a part of the same wave touches too (a lockfile or codegen output both regenerate, migration numbering, snapshot files, a whole-project build or typecheck, a port, a database or fixtures); `shared`, or no field, otherwise. Parts whose `Files:` overlap get a `depends-on`, never a worktree. Each part holds at most 8 tasks and 8 KB; split an oversized part with `bdk part split`, never by dropping test cases.

Write each task as a contract, as [task shape](references/task-shape.md) shows: its goal in a few sentences, the exact signatures, types, formats and messages another task consumes, `Files:` naming every file it creates, modifies or tests, `Depends on:` for tasks of the same part it builds on, and `Stop rule:` where a worker could widen it. The worker writes the code, so a task carries no function body; a fenced block only fixes an exact external format.

Test cases are the core of each task. Each names an input or situation and the result a test asserts; every behaviour the task states has one, including the boundaries and error paths the task or the design names. A task whose files are all non-executable content carries `Verification: none` instead.

For each capability a part names in `spec-impact`, write `spec-delta/<capability>.md` and run `bdk spec delta check <capability> --json` until it passes. Then go through the `BDK-PL` rules of the instruction by id, correct the parts until each holds, and run `bdk done plan --json`. `bdk part list --json` shows each part's task count, size and wave.

## Verify and correct

When the next node is `plan-verify`, first check the parts yourself against "Blocking categories (P8)" in the BDK context above, such as each signature a task states against the code: correct what would fail a blocking category, and leave alone what the "Not a fail" list names. This check writes no entry and no file of its own, so the verifier still reads the plan with fresh eyes. Then run `/bdk:verify-plan` and act on its verdict without asking what the plan, the design or the code settle:

- **Blockers whose fix changes no recorded decision** (`false-code-claim`, a behaviour without a test case, a design requirement no task covers, an undeclared dependency between parts): correct the parts, then `bdk log resolve <id> resolved --reason "<what changed>"`.
- **Blockers whose fix contradicts an accepted decision or a sentence of the design, or grows the scope beyond the intent** (such as a caller whose user-visible behaviour the Change alters): ask the user one question listing every such blocker with your proposed fix and, for scope, the intent-only option with a follow-up Change; record each answer as a `decision`, then correct and resolve.
- **Findings**: with a failing verdict, fix those that change what a worker builds together with the blockers. A passing verdict, `done-with-concerns` included, closes the plan: every finding goes to execution, where the workers read it in the ledger, and the report gives each one with its reason. An edit after a passing verdict makes it stale and costs a round the kernel may not have.

After any correction, run `bdk done plan --json` and `/bdk:verify-plan` again, so the verdict is never older than the plan. Repeat until the verdict passes with no live blocker. The kernel's verifier budget is the only limit on rounds: no blocker fix is skipped to save a round, and only `parked` ends the loop early. `/bdk:verify-plan` reports the kernel's next action: on `escalate` the next round opens escalated; on `parked` stop and name the resume command the kernel printed, with the blockers that remain.

With `--review`, once the verdict passes, show the plan in one review, a rich decision with the content of the report below, where the user accepts it or requests changes. A requested change is written, marked with `bdk done plan`, verified again and shown in a new review.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged. `policy/validation-failed` on `bdk done plan` names the failing check; fix the part it names.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP`, exit 4 or exit 5: stop and report the output to the user.

## Finish

Report from the kernel's output only: the parts with their waves and task counts (`bdk part list --json`), each correction you made, each finding with its decision and reason, each pending `review: true` entry from `bdk change status --json` with its id and summary, and the command that starts execution, `/bdk:execute`, which the user types. End your turn there.
