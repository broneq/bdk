# Design

## Context

- `plan-draft` (#191, `2026-10-08-v3-191-plan-blocks`, design "Eval results"): Δ 0.00 on `plan-draft-csv-export` and `plan-draft-fix-after-verify`; both arms wrote the same parts on a six-scenario Change. The skill adds over the schema's plan instruction: step 2 (read the code the design names, no guessed signature, stop on a gap), step 3 (cut by files, fewest waves, part limits), step 4 (every fact a part needs written into it), step 5 (`bdk plan check` until exit 0).
- The B1-sized fixture (#243, `2026-10-08-v3-243-b1-eval-fixture`): `household-book.sh` is the ready-to-plan state of `add-household-book` (8 spec deltas, 71 scenarios, design approved); its reference plan in `household-book-planned.sh` has 7 parts, 27 tasks, 62 files in 3 waves and a passing `verify-plan` report.
- `/bdk:plan` (#199) composes `plan-draft`, `bdk plan check` and `verify-plan` in a loop bounded by `policy.budgets.verifier`. A plan that fails verification costs a further opus round and a fix; one that fails the check costs a fix before the verifier starts.
- Grader types of `claude plugin eval` (2.1.292): `regex` on the last message, the trace or one file, `file_exists`, `tool_used`, `tool_order`, `llm`, `baseline`. None reads a set of files or runs a command, so per-plan properties across seven or more part files cannot be a grader.

## Goals / Non-Goals

**Goals:**

- A recorded with/without result for `plan-draft` on the B1-sized Change, measured on what the plan stage needs from it, not only on what the harness can grade.
- A keep, change or remove decision for `plan-draft` from that result, by a rule fixed before the result is read (D3).

**Non-Goals:**

- Timing execute or plan-to-PR (#208).
- Measuring the gap stop: the fixture's design is approved and has no gap.

## Decisions

### D1. One block case on the ready-to-plan state, run with and without the plugin

`plan-draft-household-book` starts from `household-book.sh` and asks, as a user would, for a draft of the implementation plan that will be verified separately. Run: `--model sonnet` (as #191 measured), 3 runs per arm, `--keep-temp` to keep each run's workspace. Graders: the first part exists; part 01's first task has the D1 contract lines; the design is read before a part is written; a `bdk plan check` passed with at most 3 waves (`regex` on the trace); the reply names parts, waves and scenario coverage (`llm`); the skill fired.

The plan-check grader only the with-arm can pass in practice: without the plugin no `bdk` is on `PATH` (eval README, "Host limits"). It is kept because a passing check is what `/bdk:plan` needs before its verifier starts, and it is read with the per-plan measurement (D2), which applies the same check to both arms.

The prompt names the separate verification on purpose. A first round asked only "Please write its implementation plan": every with-arm run then ran the whole plan stage (two `verify-plan` reports in each workspace, 407-577 s, $1.60-2.11), which is `/bdk:plan`'s job and right for that prompt, but it measures the orchestrator, not the block. That round is kept as a data point of the plan stage (Measurement, round A).

Alternative: reuse `plan-draft-csv-export` with the fixture swapped - lost: its graders name `add-csv-export` and its limits are sized for a two-part plan.

### D2. Per-plan measurement on the kept workspaces

For every run of both arms, on the workspace the run left:

1. `bdk plan check` on the parts with the fixture's default limits: exit code, parts, tasks, waves, problems.
2. Scenario ownership: each of the 71 scenarios of the spec deltas is named by exactly one part's `## Acceptance scenarios` (capability, requirement and scenario on one line).
3. Task contracts: tasks with all of `File:`, `Interface:`, `Verified by:`.
4. `verify-plan`: `/bdk:verify-plan add-household-book` with the plugin, on a copy of the workspace (the opus `bdk:verifier`); its `Verdict:` and the number of `Must address` items. This is the product-level check: the verifier reads the code and the specs and fails a plan an implementer could not build from.
5. Time and cost of the planning run, from the harness result.

Item 4 is the measure that matters most: `/bdk:plan` loops on it, and a plan that passes it first time saves an opus round and a fix.

Alternative: an `llm` grader over all parts - lost: long output graded by a judge varies (#189 D3), and the judge sees one file. A committed analysis script - lost for now: this is a one-off measurement (CLAUDE.md, one-off operational work); the method is fixed here so it can be repeated, and the free test `household-book.test.ts` already holds the ownership and size checks for the reference plan.

### D3. Decision rule, fixed before the runs are read

- **Keep** when the with-arm is better on the product measures of D2 (more first-time `verify-plan` passes, fewer `Must address`, or more plans passing `bdk plan check` with all scenarios owned once) and not worse on the others.
- **Change** when the with-arm is not better and the runs show a concrete step of the skill that fails (a step the with-arm skips or gets wrong); the change goes into the skill, built with `/skill-creator`, and is measured again on this case.
- **Remove** when both arms are equal on every product measure and the skill costs more time or money: then the schema's instruction carries the block, and the follow-up is to let `/bdk:plan` write the parts without a named block.

## Measurement

2026-10-08, Claude Code 2.1.292, `--model sonnet`, clean `HOME`, `PATH` without other plugins' `bin/`. Each plan was then checked by `bdk plan check` and by one `/bdk:verify-plan add-household-book` round (`claude -p --plugin-dir plugins/bdk`, main thread sonnet, `bdk:verifier` opus) on a copy of its workspace outside this repository.

Runs:

- **B** `plan-draft-household-book` with the final prompt, 3 runs per arm (harness).
- **C** `claude -p "/bdk:plan-draft add-household-book"` on three fresh `household-book.sh` workspaces: the block alone, 3 runs.
- **A** the first round of the case (prompt without "verified separately"): the without-arm counts as three more no-plugin runs; the with-arm ran `/bdk:plan` and is reported apart.

Harness score of B: WITH 1.00, W/OUT 0.80, Δ +0.20; the only grader the without-arm fails is `plan-check-clean`. A gave the same scores.

Per plan (the block: B with-arm and C; no plugin: B and A without-arm):

| Measure | `plan-draft` (6 runs) | no plugin (6 runs) |
|---|---|---|
| `bdk plan check` exit 0 with the default limits | 6/6 | 0/6 |
| check problems | none | part 01 over `max-tasks` (7-9 of 5) and `max-files` (11-13 of 10) in every run; one also over `max-bytes`, one a second part over `max-tasks` |
| waves | 3, 3, 3, 2, 3, 3 | 3, 3, 4, 3, 3, 3 |
| wave shapes | 1-2-7, 1-1-8, 1-2-8, 1-1-6, 1-9, 1-7-1 | 1-6-1 (five runs), 1-6-1-1 |
| parts / tasks | 8-11 / 30-33 | 8-9 / 29-35 |
| scenarios owned exactly once (of 71) | 71 in every run | 71 in every run |
| tasks with `File:`, `Interface:`, `Verified by:` | all, but one task in two runs | all |
| `verify-plan` first round `Verdict: PASS` | 4/6 | 0/6 |
| `Must address` per plan | 0, 2, 0, 0, 1, 0 | 2, 3, 3, 2, 2, 2 |
| `Must address` other than the part limits | 3 in two runs: a dispatcher reading `src/commands/` that no part creates; a scenario verified through `export` where the spec says `list`; a `Verified by:` joined to the `Interface:` line | none |
| time, cost of the planning run | B 221-232 s, $0.74; C 157-189 s, $0.56-0.69 | 108-204 s, $0.43-0.64 |

Round A, with-arm (`/bdk:plan`: draft, check, verify, fix, verify): every run ended on a passing `verify-plan` report; one more independent `verify-plan` round passed all three final plans. 407-577 s, $1.60-2.11 per run for the whole plan stage.

What the numbers say:

- The effect of the block on this Change is the part limits. Without the plugin every plan fails `bdk plan check` on its foundation part, and `verify-plan` fails it for that alone. With it, every plan keeps the limits, mostly by splitting the foundation into a small contracts part and a second part (`1-1-x` or `1-2-x`), still at most three waves.
- Read without the limits, the no-plugin plans were as sound as the block's: every scenario owned once, no wrong name or missing dependency found by the verifier. The self-contained part rule and the code reading of step 2 show no measurable gain here; two of the six block plans had a defect the verifier caught, none of the no-plugin ones.
- The block costs 20-80 s and $0.10-0.25 more per draft than a draft without it. A no-plugin draft that fails the check costs at least one fix and a further verifier round in `/bdk:plan` (one verifier round on this Change: 85-143 s, $0.59-0.85).

## Decision

**Keep `plan-draft`.** By D3, the block is better on the product measures (check passes 6/6 against 0/6, first-round verifier passes 4/6 against 0/6, fewer `Must address` per plan) and not worse on scenario ownership or waves. Its draft costs less than the verifier and fix round that a draft without it needs on a Change of this size.

No change to the skill: the two block plans with a semantic defect fail at different steps (a file no part creates, a scenario verified through the wrong command, one malformed task), with no step the block skips or gets wrong in more than one run, so D3 "change" does not apply; `verify-plan` caught each of them, as the plan loop intends.

Not measured, left to follow-up issue #253: the stop on a design gap, which needs a variant of the fixture whose design leaves a product choice open.

## Risks / Trade-offs

- [Three runs per arm on one Change is a small sample] -> the decision names the size of the difference; a difference of one run is reported as such, not as an effect.
- [The verifier (opus) varies between rounds] -> each plan is verified once, by the same skill and model for both arms; the reference plan's verify report (#243) shows a PASS is reachable.
- [The without-arm cannot run `bdk plan check`] -> D2 applies the same check to every arm's parts after the run.
- [Shared ground: `plugins/bdk/evals/README.md`] -> one new paragraph and a corrected count; announced to the other agents.
