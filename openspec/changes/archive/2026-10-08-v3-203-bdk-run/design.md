## Context

See proposal.md for why. What this Change builds on:

- Architecture (`docs/design/2026-10-07-v3-architecture.md`): the catalog row "`/bdk:run` | main thread | the stages in order over a queue of Changes; gates by `policy.gates` | `run.json`"; the "Autopilot" sequence (propose, design, the design gate, plan, execute in a background lead, review rounds, close, next Change of `run.json`, a report of PRs and decisions taken without the user); "Autopilot continuation" (the skill text drives the run, no hook; one session for the whole queue; resume from files; the deferred `Stop` hook engine); the risk rows "the model leaves the `/bdk:run` loop early" and "one writer per file: `/bdk:run` for `run.json`".
- D9 (`docs/design/2026-10-07-v3-skills-decisions.md`): every Change branches from the base branch the run started on and gets its own PR; the queue is ordered by "blocked by"; a Change whose blocker in the queue is not merged into the base branch is skipped and listed; a run started again after a merge picks the waiting Changes up; nothing rebases or force-pushes.
- Spec `bdk-cli/run` (#188): `bdk run status --json` derives the stage of every queued Change from files (resume table rows 1-9) and validates `run.json` (`version`, `mode`, `queue[].change`, `queue[].issue`, `current`); unknown keys are ignored. It never calls git or the network.
- The stage skills, merged: `/bdk:propose` (#197), `/bdk:design` (#198), `/bdk:plan` (#199), `/bdk:execute` (#200), `/bdk:auto-review` (#201), `/bdk:close` (#202). Each checks `run.json` itself and stops on a stage that is not its own; each ends with a report and "end your turn"; execute and auto-review start a `bdk:lead` in the background and wait for its notification; close takes `--base` and creates the branch `<change>` only when it finds itself on the base branch.
- Draft 1 `skills/stages/run` (read, not copied): a loop over `bdk next`, gates passed by hooks, and a run that answered every stage's questions with the recommended option. The B1 findings name the root cause: process moved into the kernel and hooks. Here the skill text holds the loop and the CLI only reports the stage.
- The eval harness (#189) with the offline `gh` stand-in (#197, #202, #205) and the `tally-reviewed.sh` fixture (#202: a reviewed Change and a bare `origin` inside the workspace).

## Goals / Non-Goals

**Goals:**

- One command carries a queue of Changes from an intent or issues to one PR each.
- A run broken off at any point continues at the right stage without repeating paid work.
- Dependencies between queued Changes never produce stacked branches or a Change built on code that is not in the base branch.
- The user can read in one reply what was opened, what waits and what was decided without them.

**Non-Goals:**

- Answering stage questions or passing gates for the user (D5 below).
- A hook that pushes a stopped run on (architecture, deferred).
- Running stages of several Changes in parallel, or one session per Change (a later measurement, architecture "Risks").
- Any CLI change.

## Decisions

### D1. A plain orchestrator skill over the stage skills

`plugins/bdk/skills/run/SKILL.md` runs in the main thread and calls each stage skill with the `Skill` tool (`bdk:propose`, `bdk:design`, ...). It holds no copy of a stage's procedure: it only picks the next stage from `bdk run status --json`, creates the branch, keeps `run.json`, checks blockers and reports. Each stage skill ends with "reply and end your turn"; the run text says that this ends the stage, not the run, and that the run reads the stage again and goes on.

Alternatives: a `bdk run next` command that returns the next action - lost, it is draft 1's `bdk next`, process in the CLI, and `bdk run status` already gives the stage. Calling the blocks directly from run - lost, it would copy six orchestrators into one skill (draft 1's "flow spread over six places"). A lead agent for the run - lost, stages ask the user (design gate, triage) and need the main thread.

### D2. Change names fixed at queue time; `/bdk:propose --name`

`run.json` needs every Change name up front (`queue[].change`), but `/bdk:propose` named the Change itself. The run names each Change by propose's own convention (`<n>-<slug>` for an issue, two to five kebab-case words for an intent) and passes `--name <change>` to propose, so the queued name and the Change directory agree. An open Change `openspec/changes/<n>-*/` of the same issue is adopted, so a Change the user proposed by hand is not opened twice.

Alternatives: run propose for every queued item first, then write `run.json` - lost, the proposals of later Changes would sit uncommitted in the tree and land in the first Change's commits, and a Change waiting on a blocker would be proposed before the blocker exists. Placeholder names replaced after propose - lost, `run.json` would change identity mid-run and every stage reads the name. `openspec new change` by the run before propose - lost, propose would still name its own Change.

### D3. Extra keys in `run.json`, no CLI change

The run needs the base branch, a Change's intent (to call propose again after a break) and its blockers. They go into `run.json` as `base`, `queue[].intent` and `queue[].blocked-by`. `bdk run status` ignores unknown keys (spec `bdk-cli/run`), and the run reads them back with `Read`. The schema of these keys is written in spec `bdk-run`.

Alternatives: validate them in `bdk run status` and print them - lost for now, no eval shows a problem a helper would solve ("Building skills (v3)"); it becomes a CLI change if a measured run shows a corrupted queue. A second file `queue.json` - lost, two files for one queue.

### D4. Branch per Change from the fetched base; when it is created

The base branch is the branch checked out when the queue is made (D9's "the base branch the run started on"); with a detached `HEAD`, `origin/HEAD`, else `main`. Before the first stage of a Change the run fetches the base and creates `<change>` from `origin/<base>` (else the local base). Every later stage of that Change switches to its branch first. The run passes `--base <base>` to `/bdk:close`, which then finds itself on the Change branch and does not create one.

The branch is created before propose, not at close as `/bdk:close` would: execute commits, so a Change without its own branch would commit onto the base, and the next Change would start on top of it. Branching from `origin/<base>` after a fetch is what lets a waiting Change start on its merged blocker (D9: "a run started again after a merge picks up the waiting Changes"); a local base would not hold the merge.

The run never switches branches over uncommitted changes of another Change: the stages before execute leave their files uncommitted on the Change's branch, and carrying them over would mix two Changes. It stops and names the files.

Alternatives: branch at close (close's own rule) - lost, see above. Branch from the local base - lost, it misses a merged blocker and can carry unpushed base commits into the PR. One branch for the whole queue - lost, D9.

### D4a. The stage of a Change is read on its branch

`bdk run status` derives a stage from the working tree. With one branch per Change, the Change directory, its `design.md` and plan parts live on the Change's branch only, so on any other branch the status reports that Change at `propose` (row 1). Measured on the `tally-queue.sh` fixture: on `add-total`, `add-count` reads `propose`; on `add-count` it reads `close`. The run therefore takes a Change as `done` when `.bdk/runs/<change>/close/pr.md` exists (the run directory is ignored by git and the same on every branch, and close writes `pr.md` last), and reads the stage of any other Change only after switching to its branch. A Change without a branch and without `pr.md` has not started.

Alternatives: a `--change` flag or a git-aware `bdk run status` that reads each Change from its branch (`git show <branch>:<path>`) - lost for now: the spec of the command forbids git calls, and the run reads one Change at a time anyway. If measured runs show the model misreading other entries, a CLI change that marks entries whose Change directory is missing as `unknown` is the first candidate.

### D5. The run asks what the stages ask; it never answers for the user

Draft 1's run took the recommended option of every question. In v3 the policy decides that inside each stage: `policy.questions` (propose, design-draft, execute), `policy.gates.design` (design), `policy.gates.review` (triage). The run therefore passes no option and answers nothing. In an interactive session a stage asks with `AskUserQuestion` and the run goes on after the answer. In a session that cannot ask, a stage that needs the user ends without reaching its end, and the run stops (D6). `mode` in `run.json` records which of the two the session was (`AskUserQuestion` available or not); it is a record for the user and `bdk run status`, not a switch.

Alternatives: the run answers with the recommended option (draft 1) - lost, it overrides the project's policy and hides decisions; a team that wants that sets `decide-and-record` and `auto` gates.

### D6. A stage that does not reach its end stops the run

After each stage skill the run reads the stage again. When the Change is still at the same stage (a gate or question waiting, a blocked part, a spent budget, a failing spec-conformance report, a failed push), the run stops with the stage's own reason and `/bdk:run` to continue. It does not go on with another Change.

The design gate is the one stage end the resume table does not show: row 2 is passed by a passing report, while `design/gate.md` holds the approval. The run treats a Change whose design report passes and whose gate file does not say `Gate: approved` as at stage `design`; `/bdk:design` then goes straight to its gate (its row 6).

Alternatives: park the stopped Change and go on with the next independent one - lost for v3.0: the stopped Change leaves uncommitted files on its branch (D4), the user is the one who must act on it, and an unattended queue that runs on past a problem spends money on Changes that may share its cause. Revisit with a measured unattended run. Stop only after N failed attempts - lost, a stage already spends its own budget (`policy.budgets.*`) before it stops.

### D6a. The run commits the planning files before execute

Found by the end-to-end run (task 4.3): `/bdk:propose`, `/bdk:design` and `/bdk:plan` each leave their files uncommitted for the user's review, and the execute lead (`execute-waves`, step 1) refuses a tree with uncommitted paths. Driven by hand, the user commits between the stages; in a run nobody does, so the queue stopped at execute with "uncommitted changes: openspec/changes/1-count-ledger-entries/ ...". Before `bdk:execute` the run now calls the `commit` block for `openspec/changes/<change>/` only. Anything else uncommitted still stops the lead, and then the run (D6), because it is not the run's to judge.

Alternatives: the execute lead commits the planning files itself - lost, it changes the merged execute stage's contract (a clean tree is its guard against foreign work) for a need only the run has. Each planning stage commits its own files - lost, three merged stages would change, and a user driving them by hand wants to review first.

### D7. Waiting Changes (D9)

A Change waits when one of its `blocked-by` Changes is not merged: not `done`, or its PR (from `close/pr.md`) is not `MERGED` by `gh pr view <url> --json state`. The check runs only before the first stage of a Change; a Change that started once its blockers merged is not checked again. In one run a dependent Change therefore always waits for its blocker's PR to be merged by a human, as D9 intends. Blockers outside the queue are not checked: the user chose the queue, and `/bdk:propose` reads the issue anyway.

Blockers come from the issue's native "blocked by" links (`gh issue view --json blockedBy`) and from body lines starting `Blocked by`, the two ways this project and its template write them.

Alternatives: detect a merge with `git merge-base --is-ancestor` after a fetch - lost, a squash or rebase merge leaves no ancestor. Treat an open PR as enough and stack (draft architecture) - lost, D9.

### D8. Eval cases at the end of the queue, plus one from the start

A full queue from an intent runs every stage with its agents: tens of minutes and several dollars per Change, and most of what it grades belongs to the stage cases that exist. The run's own behaviour is the loop around the stages: queue order, the branch per Change, `run.json`, resume, waiting and the report. The cases grade that on states where the stages are cheap:

| Case | Start | Graded |
|---|---|---|
| `run-two-prs` | `run.json` with two reviewed Changes of the `tally` CLI (`add-total`, `add-count`), each on its own branch from `main`, `current` the first | `close` called twice, in queue order; PR 1 and PR 2 into `main` with heads `add-total` and `add-count`; both branches on the remote; reply names both URLs |
| `run-resume` | the same, but `add-total` closed (archived, pushed, PR 1, `close/pr.md`) and `add-count` archived and committed without a push | no `bdk:verifier`, no `openspec archive`; PR 2 opened; no PR 3; `add-total` not touched |
| `run-waiting-blocker` | `run.json` with reviewed `add-total` (issue 1) and `count-entries` (issue 2, `blocked-by: [add-total]`) not started | PR 1 opened; no PR 2, no `openspec/changes/2-*`/`count-entries`, no branch, no propose call; reply names `count-entries` waiting on `add-total` |
| `run-queue-from-issues` | the `tally` project on `main` with `origin`, issues 1 (blocked by 2) and 2, no run | `run.json` holds issue 2 then issue 1 with `blocked-by`, `base: main`; `bdk:propose` called with `--name`; `openspec/changes/2-*/proposal.md`; the run stops at the design gate (manual, no `AskUserQuestion` in an eval run) |

The fixture `tally-queue.sh` builds on `tally-reviewed.sh`: a second reviewed Change `add-count` on its own branch from `main`, the issues in the stand-in store, and `run.json`. `run-two-prs` alone shows the acceptance signal "a two-Change queue ends with two PRs" through the run loop; one end-to-end run from an intent in a scratch project (task 4) shows the same from the start of the queue.

Alternatives: a case that runs both Changes from an intent - lost as an eval: its cost and run time per sample would be the sum of every stage case, and its failures would mostly be stage failures already graded elsewhere. It runs once by hand instead.

## Risks / Trade-offs

- [The model leaves the loop after a stage's "end your turn"] - the run text says, at the call of every stage, that the stage's end is not the run's end; the cases grade two closes in one run; a measured pattern of early stops is the trigger for the deferred hook engine (architecture).
- [Compaction during a long queue] - every decision of the loop comes from `bdk run status`, `run.json` and the run files, never from memory; the skill says so.
- [`gh` not logged in at a blocker check] - the blocker counts as not merged, so the Change waits; the report quotes the `gh` error.
- [Uncommitted files of a stopped Change] - D4 stops before switching; the user commits, stashes or continues the Change with `/bdk:run`.

## Measurements

Claude Code 2.1.292, recorded 2026-10-08.

**Orchestrator cases** (`--ablation none`, 3 runs each, offline `gh` stand-in, clean `HOME`, git shell prefix of the evals README):

| Case | Score | Pass | Cost (3 runs) |
|---|---|---|---|
| `run-two-prs` | 1.00 | 3/3 | $3.42 |
| `run-resume` | 1.00 | 3/3 | $1.15 |
| `run-waiting-blocker` | 1.00 | 3/3 | $2.03 |
| `run-queue-from-issues` | 1.00 | 3/3 | $2.75 |

All four cases: 392 s with `-j 4`, $9.35 in total.

**End to end from issues** (task 4.3): `claude -p "/bdk:run #1 #2"` in a scratch `tiny-ledger` project configured for BDK with a bare `origin`, the offline `gh` stand-in, two independent issues, `policy.gates.design: auto`, `policy.gates.review: auto`, `policy.questions: decide-and-record`, `execution.lead: foreground`.

1. First session ($1.40, 167 s): propose, design, plan of `1-count-ledger-entries` on its branch from `origin/main`; execute stopped (`uncommitted changes: openspec/changes/1-count-ledger-entries/ ...`), and the run stopped correctly without starting the second Change. This found D6a.
2. After D6a, `claude -p "/bdk:run"` resumed at execute: the commit block committed the planning files, execute built part 01; the session then hit the account's usage limit inside auto-review ($1.05, 164 s).
3. `claude -p "/bdk:run"` resumed at auto-review (round 1 found nothing), closed the first Change (PR 1), created `2-find-largest-expense` from `origin/main`, ran every stage of it and closed it (PR 2), then gave the final report ($3.95, 584 s, 128 turns).

Result: PR 1 (`1-count-ledger-entries`) and PR 2 (`2-find-largest-expense`), both into `main`; `git log main..2-find-largest-expense` holds only the second Change's four commits. Two resumes continued at the right stage (execute, then auto-review). Total $6.40 for two Changes.

## Open Questions

None. D9 settles the only open point of the issue.
