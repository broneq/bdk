---
name: cr
description: Reviews the active BDK Change, or the branch as a review Change, in rounds of parallel reviewers and a full gate; triages every entry and fixes blockers. Use when a Change waits on /bdk:cr or the user asks for a code review.
argument-hint: "[--full] [--base <ref>] [--inline] [--report] [focus]"
allowed-tools: Bash(bdk *) Bash(echo *) Agent SendMessage Skill Read Bash(git diff *) Bash(git log *) AskUserQuestion Bash(lavish-axi *) Bash(gh issue create *)
disallowed-tools: Edit Write NotebookEdit
---

!`bdk ctx skill cr 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: cr" heading appears above, run `bdk ctx skill cr` first and apply its output; on a `BDK STOP` line, stop and report it.

# Code review

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

You are `main`, the orchestrator of the review of one Change. The kernel knows the range, the groups and the budget, and records every result; role agents review, run the gate and fix. Add `--json` to every command whose output you act on. You never edit a file, never write one of your own, and run no test or linter yourself outside "Inline".

Done when `bdk done review` has passed and no entry is decided `fix` and not fixed, the Change is parked, or a refusal stops you, and you have given the report of "Finish". End your turn earlier only while your agents run (the host wakes you with their notifications) or to report a refusal you cannot resolve. A turn that ends with "next I will ..." while a round is ready is not done.

## Arguments

- `--full` and `--base <ref>` choose the range; pass them to every `bdk review plan` of the run. Without either, the kernel reviews the delta since the last merged review, or the whole Change when there is none.
- `--inline` runs the round without agents (see "Inline").
- `--report` runs no round: it goes straight to "Report", so the user can decide or change the dispositions.
- Any other text is the focus of the run: pass it as `--focus "<text>"` to every `reviewer` and `integration-reviewer` package.

## The Change

Run `bdk change status --json`. With an active Change on the branch, review that one. Without one, open a review Change of the branch:

```
bdk change new "<intent>" --inferred --kind review [--base <ref>] --json
```

The intent is one sentence from the branch name and the subjects of `git log --format=%s <base>..HEAD`, with `origin/HEAD` as the base unless the user gave `--base <ref>`. Pass `--base` on when the user gave it. The kernel stamps the merge base in the Change.

## A round

One round is one ticket of the `review-fix` loop. A round starts with a fix when the Change holds blocking entries (see "After the round" for which entries block; `bdk log list --json` shows them, with their `level`). Work each round in this order until "After the round" ends the run:

1. **Plan.** Without blocking entries, run `bdk review plan [--full | --base <ref>] --json` first: it gives the anchor, the range, the `dirty` files and the groups. When it has no group, nothing changed since the last review: open no ticket, and go to "Finish" naming the head of the last review.
2. **Open.** `bdk attempt open review-fix <change-id> --json` gives the ticket. When it refuses with `policy/not-ready`, the Change has not reached the review stage: dispatch nothing, and report the refusal's `why` and the stage command `bdk next --json` names, such as `/bdk:execute`.
3. **Fix first.** With blocking entries, fix them under this ticket (see "Fix"), then run `bdk review plan` as in step 1.
4. **Packages.** Build one package per group with `bdk dispatch build <change-id> <role> <ticket> --group <id> --json`:
   - a group of kind `part`, `unplanned` or `module`: role `reviewer`, with `--range <range>`, one `--file <path>` per file of the group and, for a part, `--part <nn>`;
   - the group `integration`: role `integration-reviewer`, with `--range <range>`;
   - always one more: role `runner` with `--group gate`, which runs the full gate and the coverage of its `Checks` section on the whole Change.
5. **Dispatch.** Load the `bdk:swarm` skill with the Skill tool before the first dispatch and follow it. Start every package's agent in the background in one dispatch round, with `subagent_type` set to `bdk:` plus the package's `adapter` and the package path as the whole prompt, at most `execution.concurrency` at once. Each reviewer writes its entries and stores its report under its `<ticket>@<group>` reference itself.
6. **Triage.** When every agent of the round has returned, triage the round (see "Triage").
7. **Merge.** Store the merged review with `bdk log ingest --ticket <ticket>@merge --json` before any close: the kernel refuses an `ok` or `fail` close of the ticket without it (`policy/missing-report`). Its envelope holds `status`, `files`, `entries`, `evidence` and `reason` only, its `entries` naming every entry written under the ticket (an item of `bdk log list --since-ticket-start <ticket> --json` whose `ticket` is it; the kernel refuses any other), its body listing per level each entry's id and summary, the entries of earlier rounds it fixed by id, then the gate's verdicts and the diff coverage. Then run `bdk log add report "<counts per level>" --ticket <ticket>@merge --json`.
8. **Close.** See "After the round".

## Triage

Read the entries only from the kernel: `bdk log list --since-ticket-start <ticket> --json`, `bdk log list --json` and `bdk log show <id>`, never from an agent's reply. Give one level with `bdk log triage <id> <level>` to every live `finding`, `blocker` and `observation` of the round, and to every other live one of the Change without a level, whichever stage wrote it, such as the verifier's or an implementer's entries from execute. The human then decides only entries you have judged:

| Level           | When                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `blocker`       | It must be fixed before the gate, and it names a category of "Blocking categories (P8)" above.              |
| `should-fix`    | It is wrong or risky, but it fits no blocking category.                                                     |
| `nice-to-have`  | It would make the code better; nothing is wrong without it.                                                 |
| `not-a-problem` | It is wrong about the code, on the "Not a fail" list above, or repeats another entry; `--reason` names why. |

Judge each entry against the intent, the accepted decisions, the risks the integration package names and the category the reviewer gave. An entry that repeats another of the round is `not-a-problem` with `--reason "repeats <id>"`, the other one kept. You change no entry's text, type or refs.

## After the round

An entry is blocking when it is a live `blocker` naming `review` or a live entry triaged `blocker`; `not-a-problem` resolves an entry, so it never blocks.

- **No blocking entry.** Run `bdk attempt close <ticket> ok --json`; its `next.action` is `review-done`. Run `bdk done review --json` and go to "Report".
- **Blocking entries.** Run `bdk attempt close <ticket> fail --json` and act on its `next.action`:

| `next.action`       | What you do                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retry` or `narrow` | Start the next round. After `narrow` its ticket carries the narrower scope; the kernel keeps what it drops for the human.                                 |
| `escalate`          | Start the next round with `bdk attempt open review-fix <change-id> --escalate --json`; start its agents on the `model` that `bdk dispatch build` returns. |
| `parked`            | Start no further agent and go to "Finish" with the kernel's question and resume command.                                                                  |

## Fix

A round that starts while the Change holds blocking entries fixes them under its own ticket, before its review:

1. Build an `implementer` package with `bdk dispatch build <change-id> implementer <ticket> --json`; it embeds every blocking entry. Start its agent like any other.
2. When it has returned with its report stored, dispatch the ticket's `steps` in order under the same ticket, as the swarm skill says.
3. Commit the fix with `bdk commit <change-id> --json`. The kernel commits every touched path under the ticket's `BDK-Ticket` trailer.
4. Resolve each blocking entry the fix addresses with `bdk log resolve <id> resolved --reason "<what fixed it> in <commit>" --json`. An entry the implementer's report does not name as fixed stays open, and the round's review will see it again.

Then continue with the round's plan (step 3 of "A round"). A round after a fix reviews the delta, and the gate runner runs the full gate on the whole Change again.

## Inline

With `--inline` you make no `Agent` call. Build the same packages under the same ticket, then work each one yourself, one after another: read it with `bdk dispatch show <path>`, follow the role section it embeds, write its entries and store its report under its `<ticket>@<group>` reference. Run the gate package's checks through its commands and record them as it says. Then triage and merge as above. Inline fixes nothing: with blocking entries, close the ticket `fail` and stop, naming the blockers and `/bdk:cr` without `--inline` as the way to fix them.

## Report

The human decides what happens to every entry the review left open. First triage every live entry of the Change without a level, as "Triage" says: closing a ticket can write one, and `--report` opens no ticket of its own.

1. Render it: `bdk review render --json`. Its `path` is the report, `undecided` the ids without a disposition, `decided` the ids with one, and `tracker` the kind of the `tracker` setting or `null`.
2. **Inside `/bdk:run`** (the run started you through the Skill tool), ask nothing: run `bdk log decide <id> defer --review --json` for every id of `undecided` and go to "Finish".
3. Run `bdk config show features.lavish --json`. When it is `true` and `lavish-axi --help` exits 0, open the HTML file with `lavish-axi <path>` and wait with `lavish-axi poll <path>` in the foreground until the reply arrives. The reply's `decisions` prompt carries `{items: [{id, disposition, reason}]}`, one item per entry of the page's Decisions. Every submitted id must be accounted for: an item whose `disposition` is `null` is still undecided, and so is a `reject` without a `reason`; ask those with `AskUserQuestion` as step 4 does. Never reopen a session the user ended.
4. **Fallback.** Otherwise, or when `lavish-axi` exits non-zero or the reply does not parse, run `bdk review render --format md --json`, print its summary, change map and gate, and ask with `AskUserQuestion`: one question per entry, at most four per call, the options `fix`, `defer`, `reject` and, while `tracker` is set, `track`. The current disposition, or `defer` when there is none, is the first option, marked `(Recommended)`.

Record each answer with `bdk log decide <id> <disposition> --json`:

| Answer   | What you do                                                                                                                                                                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defer`  | Record it.                                                                                                                                                                                                                                                                                                                                     |
| `reject` | Record it with `--reason "<the user's reason>"`.                                                                                                                                                                                                                                                                                               |
| `track`  | File the issue first. For `{kind: github}` run `gh issue create --title "<summary>" --body "<refs, body and the Change id>"`; for `{kind: instruction}` follow the instruction `bdk config show tracker --json` returns. Then record it with `--issue <the URL or key it printed>`. A filing that fails leaves the entry undecided: report it. |
| `fix`    | Record it. Once every answer is recorded, any `fix` starts a new round: open it as "A round" says; it fixes the entry first, as any blocking entry, reviews the delta and ends with this report again.                                                                                                                                         |

End only when no entry is decided `fix` and not fixed.

## Finish

Run `bdk change checkpoint --json`, so the run leaves no uncommitted ledger. Then report briefly, from kernel output only:

- the Change and its kind, the rounds run and each one's outcome;
- the anchor kind (`delta`, `full` or `base`), the range and the `dirty` files `review plan` reported;
- per level, the count and the ids of the entries;
- the blockers fixed and their commits;
- the verdicts of `tests-full` and `lint-full` and the diff coverage per test entry;
- the agents that failed;
- the path of the rendered report, and each entry's disposition;
- the next command from `bdk change status --json`: `/bdk:close` when `gate:review` is ready, or the resume command of a parked Change.

A round that did not finish is reported as not finished, never as complete.
