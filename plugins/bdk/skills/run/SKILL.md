---
name: run
description: 'Autopilot over a queue of OpenSpec Changes - builds the queue from an intent, an issue or a list of issues (ordered by "blocked by"), writes .bdk/runs/run.json, gives each Change its own branch from the base branch, and runs propose, design, plan, execute, auto-review and close in order until every Change has a pull request. A Change whose blocker in the queue is not merged waits. Resumes from files. Use when asked to carry a feature, an issue or several issues end to end, to "run" or "continue the run", or to work through a list of issues to pull requests.'
argument-hint: '["<intent>" | #<issue> [#<issue> ...]]'
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git *) Bash(gh *) Bash(openspec *) Read Write Edit Glob Grep Skill Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Run

You run a queue of Changes through the stage skills, one Change at a time, each on its own branch, until each has a pull request. You compose; you never do a stage's work: you do not write a proposal, a spec, a design, a plan part or code, review, triage, archive or open a pull request yourself, and you commit only through the `commit` skill, before execute, and you never answer a stage's question or pass a gate for the user. The only file you write is `.bdk/runs/run.json`. You never rebase, reset, force-push, merge or stack one Change's branch on another's. Run each command on its own, without `;`, `&&` or pipes.

The stages, each called with the Skill tool:

| Stage | Skill and arguments |
|---|---|
| `propose` | `bdk:propose` with `#<issue> --name <change>`, or `"<intent>" --name <change>` |
| `design` | `bdk:design` with `<change>` |
| `plan` | `bdk:plan` with `<change>` |
| `execute` | `bdk:execute` with `<change>` |
| `auto-review` | `bdk:auto-review` with `<change>` |
| `close` | `bdk:close` with `<change> --base <base>` |

**A stage's end is not the run's end.** Every stage skill ends with a report and "end your turn". Inside a run that ends the stage only: give its report in one or two lines and go back to step 7. When a stage starts a background `bdk:lead` and tells you to wait for its notification, end your turn; when the notification arrives, finish that stage as its skill says, then go back to step 7. Stop only where this skill says to stop.

**Files, not memory.** After a break or a compaction, everything you need is in `run.json`, `bdk run status --json` and the run files; read them again instead of recalling.

## 1. Check the configuration

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: write nothing, create no branch, call no stage, and reply with that line.

Done when the project is configured.

## 2. Load or build the queue

A Change of a queue is **done** when `.bdk/runs/<change>/close/pr.md` exists.

- No arguments, `.bdk/runs/run.json` exists: read it and go to step 4.
- No arguments, no `run.json`: ask the user what to run (an intent or issues), write nothing, and stop.
- Arguments, and `run.json` holds a Change that is not done: change nothing. Reply with its queue (each Change, done or not) and that `/bdk:run` without arguments continues it, and stop.
- Arguments otherwise: go to step 3; the new queue replaces a finished `run.json`.

Done when you hold a queue, or stopped.

## 3. Build a new queue

1. **Input.** Issue references (`#12`, `12`, `owner/repo#12`, an issue URL), one or more; anything else is one intent.
2. **Issues.** For each: `gh issue view <n> --json number,title,body,state,url,blockedBy` (`owner/repo#12` as `12 --repo owner/repo`). When it exits non-zero, stop: write nothing and quote the `gh` error.
3. **Names.** An intent: kebab-case, two to five words of the change. An issue `<n>`: when an open directory `openspec/changes/<n>-*/` exists, its name; else `<n>-<slug>`, the slug two to four kebab-case words of the title. Every name matches `^[a-z0-9][a-z0-9-]*$`.
4. **Blockers.** An issue's blockers are the numbers in `blockedBy.nodes[].number` and every `#<n>` on a body line starting with `Blocked by`. Keep only issues of this queue; a blocker outside the queue is no reason to wait (name it in the final report).
5. **Order.** Put each Change after every Change that blocks it; otherwise keep the user's order. On a cycle, stop: write nothing and name the issues of the cycle.
6. **Base.** `git branch --show-current`; when it prints nothing (detached `HEAD`), `git symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/`, else `main`.
7. **Mode.** `interactive` when the `AskUserQuestion` tool is available in this session, else `non-interactive`.
8. **Write** `.bdk/runs/run.json` with Write, `current` the first Change:

```json
{
  "version": 1,
  "mode": "interactive",
  "base": "main",
  "queue": [
    { "change": "2-mark-void-entries", "issue": 2 },
    { "change": "1-skip-void-in-balance", "issue": 1, "blocked-by": ["2-mark-void-entries"] }
  ],
  "current": "2-mark-void-entries"
}
```

A Change from an intent has `"intent": "<the intent>"` instead of `issue`. Omit `blocked-by` when there is none. Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" run status`: when it exits non-zero, fix the file it names and run it again.

Done when `bdk run status` exits 0 on the new `run.json`.

## 4. Take the next Change

Go through the queue in order and take the first Change that is neither done nor waiting in this run:

- Its branch exists (`git rev-parse --verify --quiet refs/heads/<change>` prints a commit): it has started. Go to step 6, switch only.
- No branch: it has not started. Go to step 5.

When no Change is left, go to step 9.

Done when you hold the next Change, or none is left.

## 5. Check its blockers

For each Change named in the entry's `blocked-by`:

- Not done: the blocker is not merged.
- Done: read the `PR:` line of its `close/pr.md` and run `gh pr view <url> --json state`. Merged only when it prints `"state":"MERGED"`; any other state, or a `gh` error (quote it in the report), is not merged.

When a blocker is not merged, the Change **waits**: do not create its branch, call no stage for it, note it with its blockers and their pull requests, and go back to step 4 for the next Change. Otherwise go to step 6.

Done when the Change waits or may start.

## 6. Switch to its branch

1. When `git branch --show-current` already prints `<change>`, skip to 4.
2. Run `git status --porcelain`. When it lists anything, stop the run: name the files and the branch they are on, and say that `/bdk:run` continues once they are committed or the Change on that branch is continued. Never carry one Change's files onto another branch.
3. Started Change: `git switch <change>`. New Change: when `git remote` lists `origin`, run `git fetch origin <base>`; then `git switch --no-track -c <change> origin/<base>` when `git rev-parse --verify --quiet origin/<base>` prints a commit, else `git switch -c <change> <base>`. The base after the fetch holds every merged blocker; no Change starts on another Change's branch.
4. When `current` in `run.json` is not `<change>`, set it with Edit.

Tell the user in one line, e.g. `Change 2 of 3: 1-skip-void-in-balance on its branch from origin/main`.

Done when `<change>` is checked out and `current`.

## 7. Run its stages

1. Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" run status --json` and read the entry of `<change>` only. The entries of other Changes are read on their own branches, never here: on this branch their files are missing.
2. Take its `stage`. When the stage is `plan`, `execute`, `auto-review` or `close`, and `.bdk/runs/<change>/design/gate.md` is missing or does not say `Gate: approved`, while `openspec/changes/<change>/plan/parts/` holds no part: the stage is `design` (its gate is open).
3. `done`: tell the user the `PR:` line of `close/pr.md` and go back to step 4.
4. Stage `execute`: the execute lead builds only on a clean tree, and propose, design and plan leave the Change's files uncommitted. When `git status --porcelain -- openspec/changes/<change>/` lists files, call the Skill tool with `bdk:commit` and the arguments `only openspec/changes/<change>/: the proposal, specs, design and plan of Change <change>` first.
5. Tell the user in one line which stage runs and why (`run: bdk:plan 1-skip-void-in-balance - design verify-2.md PASS, gate approved`), and call the stage's skill from the table. Follow it to its end.
6. Run the status again. When the Change's stage moved past the one you called (or the design gate is now approved), go back to 2. When it is the same stage, go to step 8.

Done when the Change is done (step 4 next), or a stage stopped (step 8 next).

## 8. Stop on a stage that did not reach its end

A stage that ends without moving the Change on is waiting for something only the user can give: a gate or a question, a blocked part, a spent budget, a failing spec-conformance report, a failed push. Stop the run here; do not start another Change. Reply with:

- the Change, its branch and the stage;
- the stage's own reason, in its words (its report, its blockers, its command);
- what the other Changes of the queue are: done with their pull request, not started, or waiting;
- that `/bdk:run` continues the queue once the cause is resolved.

End your turn there.

## 9. Final report

Every Change is done or waits. Reply with:

1. One line per Change in queue order: the `PR:` and `Base:` lines of its `close/pr.md`; or `waiting` with each blocker that is not merged and its pull request.
2. Every decision taken without the user, per Change, from `.bdk/runs/<change>/close/pr.md` (the same on every branch): the decisions part of its pull request body, where `/bdk:close` gathers the proposal's, the design's and the review's, so read no other file for them and list each once. Write `none` when a Change has none.
3. Blockers outside the queue that are still open, from step 3.
4. When a Change waits: that `/bdk:run` continues it after its blockers are merged.

The pull requests wait for the user's review; you merge nothing. End your turn there.
