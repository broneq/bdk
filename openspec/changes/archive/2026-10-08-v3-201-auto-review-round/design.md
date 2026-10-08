# Design

## Context

- Architecture (`docs/design/2026-10-07-v3-architecture.md`): `/bdk:auto-review` is a main-thread orchestrator composing `review-round` (lead) rounds, `triage` and fixes through `execute` ("Catalog"); `review-round` is only a lead skill, started by `/bdk:auto-review` ("Layers"); "Flows / Review round": groups from `bdk git groups` (scope since the last round), group reviews, `bdk check run` and `e2e-check` in parallel, then integration, then the judge writing `review/round-N/report.md`; a later round covers only the scope of the fixes; E2E in every round. "Flows / Autopilot": loop until no blockers, `review-round` in the background, triage, execute of the fixes. Resume rows 5 to 8 ("Autopilot continuation", spec `bdk-cli/run`).
- `docs/design/2026-10-07-v3-skills-decisions.md` D2 (levels; a rule violation is never a blocker), D3 (auto mode: `blocker` and `should-fix` `fix`, `should-fix` within `policy.budgets.review-rounds`; `nice-to-have` `defer` without an issue; `not-a-problem` `accept`; "a `should-fix` finding does not by itself start another review round; only the fix scope is reviewed in the next round").
- What exists: the review blocks and their agents (#193, spec `review-blocks`), `e2e-check` on `bdk:e2e-tester` (#194), `triage` (#195), `bdk:lead`, `execute-waves`, `implement-part`, `conform-part` (#192, #200, specs `bdk-execute`, `bdk-execute-blocks`); `bdk git groups --rounds --plan --record` with the round record (#186, spec `bdk-cli/git`); `bdk check run --round` appending red checks as findings (#183); `bdk findings add|level|decide|list|report` (#187, #195); `bdk run status` rows 5-8 (#188); `policy.budgets.review-rounds` (3), `policy.gates.review`, `execution.lead`, `execution.max-parallel`, `models.*` (spec `bdk-cli/config`).
- Inputs read, not copied: draft 1 `skills/tools/cr` (agent scaling by change size, one reviewer per layer group, a merge step, the full change reviewed every time) and the B1 findings: four rounds, rounds 3 and 4 spent on one or two minor entries, and review cost dominated by re-reading the whole change. Kept: groups by plan part, integration after the groups, a judge, a report. Dropped: full re-review of every round, agent scaling formulas (the groups come from the CLI), the merge step (the findings log folds itself).
- Host facts from #200: a subagent cannot change its working directory; the main thread of `claude -p` waits for a background lead's notification, but only 10 minutes after its last turn (Claude Code 2.1.294: "Background tasks still running 10m after the last turn ...; stopping them", seen in this Change when round 2 ran in the background), so the orchestrator cases set `execution.lead: foreground` as the architecture prescribes for non-interactive runs; a subagent's `Write` to `REPORT*`, `SUMMARY*`, `FINDINGS*` or `ANALYSIS*` `.md` is refused, so the round's own file is `round.md` and the stage's file `result.md`.

## Goals / Non-Goals

**Goals:**

- One round end to end in one lead, its workers in parallel; the main thread holds only the counts line and the files.
- Rounds after the first review only the fix commits, so a fix round costs what its fixes touch.
- Fixes built by the same execute lead and blocks as the plan, with tests first and conform, without a second implementation path.
- Every step writes a file, so `/bdk:auto-review` resumes after a break from the round directories alone.

**Non-Goals:**

- `/bdk:pr-review` (#205) and `/bdk:run` (#203); `/bdk:debug`.
- A configurable triage policy (D3 keeps it fixed).
- A workflow version of `review-round` (architecture "What We Did NOT Decide").
- Measuring a review on the B1-sized fixture (follow-up issue).

## Decisions

### D1. Three skills, one job each

| Skill | Runs in | Job |
|---|---|---|
| `/bdk:auto-review` | main thread | composes rounds, triage, fix planning and the fix pass; writes `review/result.md` |
| `review-round` | `bdk:lead` | one round: scope, parallel group reviews + checks + E2E, integration, judge; writes `round.md` |
| `plan-fixes` | main thread | an author block: the `fix` decisions of a round as fix parts |

`review-round` composes the review blocks as `/bdk:execute`'s lead composes the execute blocks; it reviews nothing itself. `plan-fixes` is a block of its own (Principle 2): writing a fix part is authoring, not composing, and it has its own eval case. It runs in the main thread like `plan-draft`: it is small (one part per few findings), and it needs no agent of its own.

Alternatives: the round in the main thread - lost, a round's worker returns would fill the orchestrator's context every round (architecture risk "Bottleneck"); the review-round lead also fixing - lost, the architecture sends fixes "through execute", and two implementation paths would drift; the fix parts written by `auto-review` itself - lost, the orchestrator only composes.

### D2. Fixes go through execute as fix parts in the round directory

`plan-fixes` writes `review/round-N/fixes/parts/NN.md` in the plan part format (frontmatter `id`, `depends-on`, `isolation`, `files`; `## Goal`, `## Acceptance scenarios`, `## Tasks` with `File`, `Interface`, `Verified by`), one task per finding, each task naming its finding id. The lead runs them with `execute-waves <change> --run-dir <dir> --parts <run dir>/review/round-N/fixes/parts`. The round's `fixes/` directory holds the parts directory `parts/`, the index `index.md`, and the fix pass's `state.json` and `result.md`, as the Change's `plan/` holds `plan/parts/`.

- **Ids** continue after the highest id among the plan's parts and every earlier round's fix parts (`bdk plan check` takes two-digit ids). So part reports (`execute/part-NN.md`), checks (`checks/NN.json`), worktrees and part branches stay unique without a new naming scheme.
- **Parts apart from index and result**: `bdk plan check` names every `.md` file in a parts directory that is not `NN.md` a stray (`index.md is not a part file`). The first try of `auto-review-fix-round` put the parts next to `index.md`, and the lead had to ignore that check problem, so the parts have a directory of their own.
- **State and result** of a fix pass live in the directory that holds the parts directory (`fixes/state.json`, `fixes/result.md`) when `--parts` is given. `<run dir>/state.json` stays the plan's part state, so `bdk run status` row 4 does not change meaning: a blocked fix part shows as resume row 8 (`fix`), where `/bdk:auto-review` resumes, not as an unfinished plan.
- **Isolation**: one fix part is `shared` (it runs in the Change checkout); several parts have disjoint files and are all `worktree`, so `bdk plan check` never reports `shared-not-alone`. `depends-on` is `[]`: every plan part is done and merged before a review.
- **Grouping**: findings on the same file go to the same part; a part keeps to `plan.part.max-tasks` and `plan.part.max-files`.
- **Contract**: a finding that breaks a scenario lists it under `## Acceptance scenarios`, so `implement-part` writes its test first and sees it red; a finding without a scenario (a rule, a crash outside every scenario) has a task whose `Verified by` names a test that reproduces the failure scenario, or the existing tests for a fix that keeps behaviour (a rename).
- **Not plannable**: a finding whose fix needs a spec or design change (the scenario itself is wrong), or that names no place and whose cause the code does not show, gets no part; `fixes/index.md` lists it under `## Not planned` with the reason. `/bdk:auto-review` stops on such a finding, naming `/bdk:design` or the user's decision.

Why the run directory and not `plan/parts/`: the Change's plan is committed, and `execute-waves` requires a clean tree; writing fix parts into it would dirty the tree after every round and mix fixes into the plan the verifier passed. Fix parts are run artifacts, like `state.json` (architecture "Change artifacts": progress is run state, not a Change file).

Alternatives: a new fix mode in `implement-part` that takes findings instead of a part - lost, it would duplicate the part contract, retries and conform; the plan's `state.json` holding fix parts - lost, a blocked fix part would send `bdk run status` to row 4 (`execute`) whose `/bdk:execute` builds plan parts only; a CLI helper writing fix parts from the log - not built: no eval or measurement shows a problem a plain block has (CLAUDE.md "Building skills").

### D3. Block inputs for fix parts: `--parts <dir>`

`execute-waves`, `implement-part`, `conform-part` and `resolve-conflict` take `--parts <dir>`; without it the parts are `openspec/changes/<change>/plan/parts/` as before. `execute-waves` passes the absolute directory on to each worker. Part reports and checks stay under `<run dir>/execute/` and `<run dir>/checks/`. The rest of each block is unchanged: a fix part is a part.

`review-group` finds the contract of a group `p<NN>` in `plan/parts/<NN>.md`, else in the `review/round-*/fixes/parts/<NN>.md` of the run directory (ids are unique, so the lookup is unambiguous); no new argument is needed because `groups.json` already names the part id.

### D4. Round scope, groups and the fix-scope review

Round 1 records `bdk git groups <base> --rounds <run>/review --plan openspec/changes/<change>/plan/parts --record <round dir>`. Round N > 1 passes `--plan <run>/review/round-<N-1>/fixes/parts` when that directory holds parts: the anchor is round N-1's recorded `head` (spec `bdk-cli/git`, "Later round reviews only the fixes"), so the groups hold only the files of the fix commits, grouped by fix part. A rerun of a crashed round reuses its `groups.json`, so it reviews the range its first run recorded.

In a round whose `groups.json` anchor has `kind: round`, `review-group` checks, for a fix part, that each task's finding (read from the previous round's log) no longer holds, and `review-integration` checks only the scenarios and contracts the scope's files reach, instead of every scenario of the Change. Without that, a fix round would cost a full integration review (opus) again, which is what B1's rounds 3 and 4 did.

`bdk check run` runs every check in every round (red checks are blockers, and a fix can break a test elsewhere); `e2e-check` drives every scenario in every round (architecture "Flows / Review round": E2E in every round). Both are cheaper than a re-review and are the product-level evidence the v3 goal asks for.

### D5. Parallelism and the round's file

The lead starts, in one message, one `bdk:reviewer` per group other than `integration` and one `bdk:e2e-tester`, and runs `bdk check run <run dir> round-<N> --round <N>` in the same message. More than `execution.max-parallel` agents run in batches. Then one `bdk:integration-reviewer`, then one `bdk:judge`. A worker that returns no result (an error, an empty reply) is started once more; a second miss is listed under `## Gaps` in `round.md` and the round goes on, because a judge without one group's findings still levels the rest, and the gap reaches the user through the result.

`round.md` holds the scope (anchor, range, files), each group with its reviewer's count, the checks verdict and file, the E2E verdict and file, the integration count, the report path, and `## Gaps`. The lead returns the report's counts line and the report path. `report.md` (the judge's) finishes the round, as spec `bdk-cli/git` and resume row 6 define.

### D6. The loop, the budget and `should-fix`

`/bdk:auto-review` derives its step from files, in this order (the same order as resume rows 5-8):

1. No round, or the last round without `report.md`: run that round.
2. The last round has an undecided finding: run `triage` on it.
3. The last round has no `fix` decision: the stage is done.
4. A `fix` decision and the round number at or above `policy.budgets.review-rounds`: blocked, budget spent.
5. `fixes/index.md` missing: `plan-fixes`. A finding under `## Not planned`: stop.
6. `fixes/result.md` missing or not `Status: done`: the fix pass. Blocked: stop.
7. Otherwise: the next round.

The budget `policy.budgets.review-rounds` (default 3) bounds the number of rounds. Before triage of round N, when N equals the budget, `/bdk:auto-review` passes `--last-round` to `triage`: in auto mode `should-fix` becomes `defer` (reason `policy.budgets.review-rounds spent`), in manual mode `defer` is the recommendation. A `fix` decision left in the last round (a blocker, or the user's choice) has no round to review its fix, so the stage stops `blocked` and names the findings and the way on: raise the budget and run `/bdk:auto-review` again, or change the decisions with `/bdk:triage`.

Why `--last-round` on `triage` and not a decision recorded by `auto-review`: triage is the one block that decides (D1 of #195), so every decision keeps one writer and one reason format. Why a round always follows a fix pass, also for `should-fix` only: resume row 8 (spec `bdk-cli/run`) holds while the last round has a `fix` decision, so unreviewed fixes would leave the Change at `auto-review` forever; and a fix that nobody checked is what the v3 correctness goal rules out. D3's concern (rounds spent on minor entries) is met by the fix-scope round (D4) and the budget: a `should-fix` never causes a round after the budget.

Alternatives: stop as soon as no blocker is left, leaving `should-fix` fixes unreviewed - lost, see above; a separate counter for fix rounds - lost, the number of rounds is the number of round directories (architecture "Run state").

### D7. The result

`/bdk:auto-review` writes `<run dir>/review/result.md`, replacing an earlier one:

```markdown
Status: done

## Rounds
- 1: 4 findings (1 blocker, 1 should-fix, 1 nice-to-have, 1 not-a-problem); fix f-9ffca2edd413, f-093cc3ee1fa8; fix parts 03: done
- 2: 0 findings; fix scope of round 1 (2 files)

## Deferred
- f-8c0aba573c66 `src/report.js:13` Report could offer a newest-first month order (nice-to-have)

## Blockers
- None.

## Decisions taken without the user
- Round 1: triage by policy.gates.review auto.
```

`Status: done` when the last round has no `fix` decision; `blocked` otherwise (budget spent, a not-plannable finding, a blocked fix pass, a crashed lead). Undecided findings after a manual triage write no result: the stage waits for the user's decisions. `## Deferred` is what `/bdk:close` lists in the PR body (D3). The reply is the status line, the path, and on `done` the next stage `/bdk:close <change>`.

### D8. Lead start, background and the queue

As `/bdk:execute` (spec `bdk-execute`, "Start of the stage"): `execution.lead` picks background or foreground, `models.lead` the model; the main thread waits for the notification without polling. `/bdk:auto-review` starts a fresh lead per round and per fix pass: a round's context is useless to a fix pass, and fresh leads keep each prompt small. When `.bdk/runs/run.json` queues the Change, `bdk run status --json` must say `auto-review`; an earlier stage stops with its command; `close` or `done` replies that the review is done.

### D9. Eval cases

| Case | Tag | Fixture | Graders |
|---|---|---|---|
| `plan-fixes-judged-round` | block | `monthly-report-judged` with decisions: the blocker and the should-fix `fix`, the others `defer`/`accept` | `file_exists` `fixes/parts/03.md`, `fixes/index.md`; `regex` `03.md` frontmatter `id: "03"`, `isolation: shared`, `files` with `src/parse.js`; both finding ids in the part; the deferred and accepted ids not in it; `bdk plan check` in the trace; no `Edit` of `src/` |
| `triage-last-round` | block | `monthly-report-judged`, auto, `--last-round` | `regex` decisions: blocker `fix`, should-fix `defer` with a reason naming `review-rounds`, nice-to-have `defer`, not-a-problem `accept` |
| `auto-review-first-round` | orchestrator | `monthly-report` (manual gate, `execution.lead: foreground`) | `file_exists` `round-1/report.md`, `round-1/round.md`, `checks/round-1.json`, `e2e/verdict.md`; `regex` both seeded bugs leveled `blocker`; `tool_used` Agent `bdk:lead`; no decision without the user; the reply asks for the decisions or names the triage page |
| `auto-review-fix-round` | orchestrator | `monthly-report-judged` (auto gate, budget 2, `execution.lead: foreground`) | `regex` `round-1/fixes/parts/03.md`; `fixes/result.md` `Status: done`; `round-2/groups.json` anchor `kind: round`, `round: 1`, and its `files` free of `openspec/` and `src/report.js` (only the fix commits); `round-2/report.md` exists; `review/result.md` written; `src/parse.js` no longer drops the decimal point (`regex`) |

The orchestrator cases are the acceptance signal: the second proves "a second round covers only the fix scope". Their cost is real (reviewers, an opus integration reviewer, an implementer and conformer); they run once each, recorded in "Measurements", not in CI.

Alternatives: a block case for `review-round` alone - lost, the skill runs only on `bdk:lead` and does nothing in the main thread (as `execute-waves`, spec `bdk-execute`); `auto-review-first-round` is its case.

## Risks / Trade-offs

- [A fix round finds a problem in code the fixes did not touch, through E2E or checks] -> it is a real problem; it is leveled and decided like any other, and the budget bounds the rounds.
- [`review-integration` in a fix round misses a seam the fix breaks outside its files] -> it follows each changed contract to every user (its step 3 "Seams"), which reaches outside the scope files; E2E and the full checks run every round.
- [Fix parts written by a main-thread author are wrong] -> `bdk plan check` checks their form; `implement-part` checks each task against its scenario before editing and stops on a plan defect, which ends the fix pass `blocked` with the part named.
- [The main thread's context grows with triage and plan-fixes per round] -> rounds and fix passes run in leads; the budget bounds the number of rounds to 3 by default.
- [Shared ground with #205 (`review-group`, `review-integration`, `judge` reused by `/bdk:pr-review`)] -> the edits add a fix-part lookup and a fix-scope rule that apply only when a fix part or a round anchor exists; announced to the agent of #205.

## Migration Plan

None: new skills; the changed blocks keep their behaviour without `--parts`, `--last-round` or a round anchor.

## Measurements

Recorded 2026-10-08 with `claude plugin eval` (Claude Code 2.1.294), three runs per arm, clean `HOME` and the git shell prefix of the eval README's "Host limits":

| Case | Kind | With | Without | Δ | Time | Cost |
|---|---|---|---|---|---|---|
| `plan-fixes-judged-round` | block | 1.00 (3/3) | 0.21 | +0.79 | 191 s (6 runs) | $1.46 |
| `triage-last-round` | block | 1.00 (3/3) | 0.33 | +0.67 | 165 s (6 runs) | $1.16 |
| `auto-review-first-round` | orchestrator | 1.00 (3/3) | - | - | not split (1529 s together with a first fix-round run) | $2.78 |
| `auto-review-fix-round` | orchestrator | 1.00 (3/3) | - | - | 969 s (3 runs) | $4.09 |

The acceptance signal holds: in every `auto-review-fix-round` run, round 2 is anchored on round 1 and its scope is only `src/parse.js` and `src/parse.test.js`, the files of the fix commit.

What the tries changed before these runs:

- The first try of `auto-review-fix-round` put fix parts next to `fixes/index.md`; `bdk plan check` reported `index.md is not a part file`, and the lead went on by ignoring it. Fix parts moved to `fixes/parts/` (D2).
- With `execution.lead: background`, `claude -p` stopped round 2's lead 10 minutes after the main thread's last turn; the orchestrator cases set `execution.lead: foreground` (eval README "Host limits").
- The first eval run of `auto-review-fix-round` timed out after 300 s in two of three runs: `timeout_seconds` in `case.yaml` is ignored when `prompt.md` has frontmatter. The timeouts moved into the `prompt.md` frontmatter, also for the `execute-*` cases, which had the same defect.
- In every fix-round run, round 2's integration reviewer found the real cents/units defect in `src/report.js` that the judged fixture leaves out of round 1. With a budget of two rounds, triage with `--last-round` keeps the blocker `fix`, so the stage ends `Status: blocked` with the command that continues. This is the designed outcome, and the graders accept both statuses.
