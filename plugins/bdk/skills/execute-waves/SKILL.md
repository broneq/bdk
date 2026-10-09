---
name: execute-waves
description: 'The execute stage of an OpenSpec Change, run by the bdk:lead agent that /bdk:execute starts (and /bdk:auto-review for the fix parts of a review round) - takes the waves of the plan parts from bdk plan check, runs each part through implement-part and conform-part in parallel batches (parts that share a wave in their own git worktrees, a part alone in its wave in the main checkout), retries and escalates within the budget, commits each part, merges the worktrees in part order with resolve-conflict on a conflict, and writes state.json and execute/result.md. Not for users: /bdk:execute is the command.'
argument-hint: "<change> --run-dir <absolute path> [--parts <absolute dir>]"
user-invocable: false
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(mkdir -p *) Bash(git *) Read Write Grep Glob Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Execute waves

Build every part of a Change's plan: waves in order, the parts of a wave in parallel, each part implemented, then conformed, then committed, then merged. You compose; the workers build. You never write or fix product code, tests, plans or specs, and you never resolve a conflict yourself. You are the only writer of `state.json`. Run each command on its own, without `;`, `&&` or pipes; run git in a worktree with `git -C <worktree>`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:lead`

This skill runs on the `bdk:lead` agent, whose instructions start with "You are `bdk:lead`". When you are not that agent, do nothing: reply that `/bdk:execute <change>` runs the execute stage, and stop.

Done when you are `bdk:lead`.

## 1. Read the inputs

- **Change**: the first argument.
- **Parts**: `--parts <dir>` when given, an absolute directory such as the fix parts of a review round (`<run dir>/review/round-<N>/fixes/parts`); else `openspec/changes/<change>/plan/parts/`. It must hold parts; otherwise stop at step 8 with the blocker `no plan: run /bdk:plan <change>` (with `--parts`: `no parts in <dir>`).
- **State file and result file**: with `--parts`, `state.json` and `result.md` in the directory that holds the parts directory (`<run dir>/review/round-<N>/fixes/`), never in the parts directory, where `bdk plan check` takes every other `.md` for a misnamed part; else `<run dir>/state.json` and `<run dir>/execute/result.md`. Never write the other pair: the plan's state stays the plan's, and `bdk run status` reads it.
- With `--parts`, a blocker this skill would send to `/bdk:plan <change>` names the part file in the parts directory instead: its author (`plan-fixes`) fixes it, through `/bdk:auto-review <change>`. A blocker that would name `/bdk:execute <change>` names `/bdk:auto-review <change>` instead: `/bdk:execute` builds plan parts only.
- **Run directory**: `--run-dir <path>`, an absolute path. Without it, take `.bdk/runs/<change>` under the path `git rev-parse --show-toplevel` prints. Run `mkdir -p <run dir>/execute`. Pass this absolute path to every worker.
- **Settings** from the configuration above, with their defaults: `execution.max-parallel` (10), `policy.budgets.part-attempts` (3), `policy.escalation.model` (`opus`), and `policy.escalation.effort`, `models.implementer.model`, `models.implementer.effort`, `models.conformer.model` and `models.conformer.effort` when set.
- **State**: the state file when it exists. Its schema:

  ```json
  {"version": 1, "parts": {"01": {"status": "done", "attempts": 1}, "02": {"status": "blocked", "attempts": 3, "reason": "plan-defect: task 2 contradicts Scenario: Empty list"}}}
  ```

  `status` is `pending`, `done` or `blocked`; `attempts` counts every implementer run of the part, in every execute run. Whenever this skill says "write the state", write the whole state file with every part of the parts directory, a part without an entry as `pending` with 0 attempts.

With `--parts`, add ` --parts <parts dir>` to every worker prompt below (`implement-part`, `conform-part`, `resolve-conflict`).

Done when you hold the Change, the parts, the run directory, the settings and the state.

## 2. Waves

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" plan check <parts dir> --json`. It exits 1 when it reports a problem; read the result anyway.

- A part with `wave: null`, or a problem `shared-not-alone`: the order of the work is unknown or unsafe. Start nothing, change nothing, and go to step 8 with the blocker naming the problems and `/bdk:plan <change>`.
- Any other problem (`max-tasks`, `max-files`, `max-bytes`, `overlap`): note it for `Decisions taken without the user` and go on. An `overlap` means the parts' merge may conflict; step 6 handles that.

Each part's `isolation` is `worktree` or `shared`. Where a part of a wave runs:

- **Main checkout**, with no `--workdir`: a `shared` part; and a part that is the only part of its wave not `done` in the state, unless its worktree directory `<run dir>/worktrees/<id>` or its branch `bdk/<change>/part-<id>` (`git branch --list bdk/<change>/part-<id>`) exists. A worktree isolates parts that run at the same time; a part alone in its wave has nothing to be isolated from, and the main checkout keeps the project's installed dependencies and warm tool caches. Count per wave, never per batch of step 5: the parts of one wave stay apart until each is committed.
- **Worktree**, `<run dir>/worktrees/<id>`: every other part. An existing worktree or part branch holds the part's earlier work, so it wins even when the part is now alone.

Never change a part file's `isolation`: the plan is the planner's. Done when you hold the waves in order and where each part runs.

## 3. Branch and tree

1. `git status --porcelain` must print nothing (ignored files never show), with one exception: the earlier work of the part that runs next in the main checkout. Take the first wave that holds a part not `done`; when a part of it runs in the main checkout (step 2), the state records at least one attempt of that part, and every listed path is one of that part's `files`, the paths are that part's work from an earlier run: keep them, and its implementer continues from them. Otherwise, when it lists paths, stop at step 8 with the blocker `uncommitted changes: <paths>; commit or stash them, then run /bdk:execute again`.
2. The base branch: `git symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/` prefix; else `main`. When `git branch --show-current` prints the base or nothing, run `git switch -c <change>`; when that branch exists already, stop at step 8 naming it. The Change's commits never land on the base.
3. A part that the state marks `done` whose branch `bdk/<change>/part-<id>` still exists (`git branch --list bdk/<change>/part-<id>`) was not merged before a break: merge it now as step 6 says.

Write the state. Done when you are on the Change's branch with a clean tree (or one holding only the kept earlier work) and nothing done is left unmerged.

## 4. Prepare the wave

Take the first wave that holds a part not `done`; when there is none, go to step 8. Its parts not `done` are this wave's parts, in ascending order. Each part gets a fresh budget in this run: `policy.budgets.part-attempts` implementer runs.

- A part that runs in the main checkout (step 2) needs nothing.
- A part that runs in a worktree runs in `<run dir>/worktrees/<id>` on the branch `bdk/<change>/part-<id>`. When that directory exists, reuse it: it holds the part's earlier work. Otherwise, when the branch exists, run `git worktree add <run dir>/worktrees/<id> bdk/<change>/part-<id>`; else `git worktree add <run dir>/worktrees/<id> -b bdk/<change>/part-<id>`, which branches from the Change branch as it is now.

Done when every part of the wave has its work directory.

## 5. Run the parts in batches

Split the wave's parts into batches of at most `execution.max-parallel`, in ascending order. For each batch, repeat until every part of the batch is `done` or `blocked`:

1. **Implement.** For each part of the batch that needs an implementer run (every part at first; later the parts to retry), add 1 to its `attempts` and write the state. Then start, in one message, one foreground Agent call per part:
   - `subagent_type: "bdk:implementer"`, prompt `Run the skill bdk:implement-part with the arguments: <change> <id> --run-dir <run dir>`, plus ` --workdir <run dir>/worktrees/<id>` for a part that runs in a worktree;
   - `model`: `policy.escalation.model` when this is the part's last run within this run's budget; else `models.implementer.model` when set; else no `model`.
   - `effort`: on the part's last run, `policy.escalation.effort` when set, else `models.implementer.effort` when set; on an earlier run, `models.implementer.effort` when set; else no `effort`.
2. **Read** each part's `<run dir>/execute/part-<id>.md`, its first line and, for a blocker, its `## Blocker` section:
   - `Status: done`: the part goes to conform.
   - `Status: blocker` with `Kind: plan-defect` or `Kind: environment`: mark the part `blocked` at once, with the kind and the evidence as `reason`. A retry cannot fix a plan or install a tool.
   - `Status: blocker` with `Kind: other`, or no report: retry the part while its budget lasts; when spent, mark it `blocked` with the last reason.
3. **Conform.** Start, in one message, one foreground Agent call per part that goes to conform: `subagent_type: "bdk:conformer"`, prompt `Run the skill bdk:conform-part with the arguments: <change> <id> --run-dir <run dir>` (plus ` --workdir <run dir>/worktrees/<id>` for a part that runs in a worktree), and `model` `models.conformer.model` and `effort` `models.conformer.effort`, each when set.
4. **Read** each `<run dir>/execute/conform-<id>.md`:
   - `Verdict: PASS`: commit the part (below), then mark it `done`.
   - `Verdict: FAIL`, or no report: retry the part while its budget lasts (the implementer reads the failed report); when spent, mark it `blocked` with the `Left` items naming tasks, or the red check, as `reason`.
5. Write the state.

**Commit a part** when its conform passed. Read `git log --oneline -10` and follow its message style (Conventional Commits when the log uses them); the message names the part, e.g. `feat(export): CSV text (part 01)`. For a part in a worktree: `git -C <run dir>/worktrees/<id> add -A`, then `git -C <run dir>/worktrees/<id> commit -m "<message>"`. For a part in the main checkout: `git add -A`, then `git commit -m "<message>"`; the commit lands on the Change branch, and there is nothing to merge.

A worker never commits; when a report says it did, or `git status --porcelain` of the main checkout lists paths after a wave whose parts all ran in worktrees, a worker wrote outside its work directory: merge nothing, and stop at step 8 with the blocker naming the paths.

Done when every part of the wave is `done` or `blocked`, its state written.

## 6. Merge the wave

For each `done` part of the wave that ran in a worktree, in ascending order (a wave run in the main checkout has nothing to merge):

1. `git merge --no-ff --no-edit bdk/<change>/part-<id>`.
2. When it succeeds: `git worktree remove <run dir>/worktrees/<id>`, then `git branch -d bdk/<change>/part-<id>`.
3. When it stops on conflicts: start one foreground Agent call, `subagent_type: "bdk:implementer"`, prompt `Run the skill bdk:resolve-conflict with the arguments: <change> <id> --run-dir <run dir>`, `model` `models.implementer.model` and `effort` `models.implementer.effort`, each when set. Read `<run dir>/execute/merge-<id>.md`.
   - `Status: done`, `git diff --name-only --diff-filter=U` prints nothing, and `git grep -n -e "^<<<<<<< " -e "^>>>>>>> " -- <resolved files>` finds nothing: `git add -- <resolved files>`, then `git commit --no-edit`, then remove the worktree and the branch as in 2.
   - Otherwise run `resolve-conflict` once more with `model` `policy.escalation.model` and `effort` `policy.escalation.effort` (else `models.implementer.effort`, when set) and check again. When it still fails: `git merge --abort`, keep the part's worktree and branch, and mark the part `blocked` with the reason `merge conflict` and the report's evidence.

Write the state. Done when every `done` part of the wave is merged into the Change branch, or blocked.

## 7. Next wave

When a part of this wave is `blocked`, do not start a later wave: later waves depend on earlier ones. Go to step 8. Otherwise go back to step 4.

Done when every wave ran, or a wave ended with a blocked part.

## 8. Write the result

Write the result file, replacing an earlier one:

```markdown
Status: blocked

## Waves
- 1: 01 02
- 2: 03

## Parts
- 01: done, 1 attempt; execute/conform-01.md PASS; merged
- 02: done, 2 attempts (the second on opus); execute/conform-02.md PASS; merged after execute/merge-02.md
- 03: blocked, 1 attempt; execute/part-03.md; ran in the main checkout, its work left uncommitted there

## Blockers
- 03: plan-defect - task 2 stores minutes, Scenario: Show duration expects seconds. Fix the plan: /bdk:plan add-timer, then /bdk:execute add-timer.

## Decisions taken without the user
- plan check: overlap 01,02 on src/routes.js in wave 1; merged in part order.
```

- A done part that ran in the main checkout ends its line with `ran in the main checkout, committed on <change>` instead of `merged`.
- `Status: done` only when every part of the plan is `done` and on the Change branch (merged, or committed there from the main checkout); else `Status: blocked`.
- Each blocker names the command that unblocks it: `/bdk:plan <change>` for a plan defect, a conflict or a plan problem; `/bdk:setup` for an environment blocker; for checks that stay red, the report to read and `/bdk:execute <change>` to retry. A blocked part names where its work stays for the next run: its worktree, or the main checkout, where its uncommitted files are its work (step 3).
- Under `Decisions taken without the user`: plan problems that did not stop the stage, escalations, merge resolutions.
- An empty section holds `- None.`

Done when the result exists and its first line is the status.

## 9. Reply

Reply with two lines: the result's status line and its path.
