---
name: debug
description: 'Fixes a reported bug end to end - diagnose-bug reproduces it on the product and writes a one-part fix Change, a gate (policy.gates.design) approves the fix, commit puts the Change on its branch, /bdk:execute builds it test-first (the reproduction test red, the fix, green, conform), and /bdk:auto-review reviews the fix Change; writes debug/result.md under .bdk/runs and resumes from the files. Use when the user reports a bug, an error message, a traceback, steps to reproduce or unexpected behaviour and wants it fixed, or asks to debug something.'
argument-hint: "[<bug report> | <issue> | <change>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git status *) Bash(git symbolic-ref *) Bash(git rev-parse *) Bash(git branch *) Bash(git switch *) Bash(git log *) Read Write Glob Grep Skill Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Debug

Fix a reported bug the way any Change is built: reproduced and diagnosed first, then built test-first, then reviewed. You compose blocks and stages and apply the gate; you never do their work. Do not reproduce, read code for a cause, write or edit a test, code or the Change, write a commit message, or review anything yourself. The only files you write are `.bdk/runs/<change>/debug/gate.md` and `.bdk/runs/<change>/debug/result.md`. Run each command on its own, without `;`, `&&` or pipes.

The blocks and stages, each invoked with the Skill tool and followed to its end:

- **diagnose-bug** `<report> [--name <change>]`: reproduces the bug, finds the root cause, writes the fix Change and `debug/diagnosis.md`.
- **commit** `only openspec/changes/<change>/: the fix Change <change>`.
- **execute** `<change>`: a `bdk:lead` builds the part (the reproduction test seen red, the fix, the test green, conform) and commits it; writes `execute/result.md`.
- **auto-review** `<change>`: review rounds of the fix Change, triage, fixes; writes `review/result.md`.

`execute` and `auto-review` may start their lead in the background and end the turn; their result arrives as a notification. When it has arrived and the stage has replied, come back here and go on with the next step: the files say where you are.

Before each step, tell the user in one line what runs and what it writes, e.g. `Diagnosing: diagnose-bug writes .bdk/runs/fix-total-crash/debug/diagnosis.md`.

## 1. Check the configuration, the tree and the input

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: run nothing and reply with that line. Otherwise note `policy.gates.design` (`manual` when absent).

- **Input**: the argument, or the bug the user describes. When it names a directory `.bdk/runs/<name>/debug/` that exists, or a Change `fix-...` whose `debug/diagnosis.md` exists, this is a resumed run of that Change: go to step 2. Otherwise it is a bug report (text or an issue reference); a name the user gives the fix Change goes to `diagnose-bug` as `--name`. Without any report, ask what goes wrong and stop.
- **Tree**: for a new report, `git status --porcelain` must print nothing; the fix runs through `execute`, which needs a clean tree. Otherwise stop before anything runs: name the changed paths and ask the user to commit or stash them, then run `/bdk:debug` again.
- **Base**: `git symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/` prefix; else `main`.

Done when you hold the report or the Change, the gate setting and the base.

## 2. Find where to start

`R` is `.bdk/runs/<change>/`. Take the first row that matches:

| # | Files | Start at |
|---|---|---|
| 1 | no `R/debug/diagnosis.md` | step 3 |
| 2 | `diagnosis.md` not `Status: ready` | step 3's outcome for that status |
| 3 | no `R/debug/gate.md` | step 4 |
| 4 | `git status --porcelain -- openspec/changes/<change>/` lists files | step 5 |
| 5 | no `R/execute/result.md`, or it is not `Status: done` | step 6 |
| 6 | no `R/review/result.md` | step 7 |
| 7 | otherwise | step 8 |

A step whose file exists never runs again. Done when you know the step.

## 3. Diagnose

Run **diagnose-bug** with the report (and `--name <change>` when given). It may ask the user for a missing symptom; then stop as well, and `/bdk:debug` continues once answered. Read the first lines of `R/debug/diagnosis.md` (the Change is its `Change:` line, or the name `diagnose-bug` reported):

- `Status: ready`: step 4.
- `Status: not-reproduced`: stop. Reply that the bug did not reproduce, what was run (`debug/reproduction.md`), and what would help; nothing was changed.
- `Status: too-large`: stop. Reply with the root cause and that the fix Change holds the proposal, the spec delta and `design.md` but needs the pipeline: `/bdk:design <change>`, then `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review`.
- `Status: blocked` or no file: stop with its reason and `/bdk:debug <change>` to retry once the cause is known.

Done when the diagnosis is ready, or you stopped.

## 4. Gate

Read `R/debug/diagnosis.md` and the part `openspec/changes/<change>/plan/parts/01.md` (its goal and tasks).

- `policy.gates.design: auto`: approve without asking.
- `manual`: ask with one `AskUserQuestion` call (load it with `ToolSearch` query `select:AskUserQuestion` when it is listed only by name), header `Fix gate`: fix `<change>` as diagnosed? Name the root cause, the reproduction scenario and the part's tasks. Options: `Fix` (recommended) and `Stop` (the user says what to change in a note or in "Other").
  - Fix: approved.
  - Stop, or a change requested: write nothing, commit nothing; reply that the fix Change is left for review (`openspec/changes/<change>/`) and that `/bdk:debug <change>` continues after the user's edits or approval. End your turn.
  - When `AskUserQuestion` is not available: ask in your reply, naming the same, and end your turn without the gate file. When the user approves in the conversation, write it then.

On approval write `R/debug/gate.md`:

```markdown
Gate: approved
By: user
Diagnosis: debug/diagnosis.md
```

`By:` is `user`, or `policy.gates.design auto`. Done when the gate file exists, or you asked and ended your turn.

## 5. Put the Change on its branch

1. `git branch --show-current`. When it prints the base or nothing, run `git switch -c <change>`: the fix's commits never land on the base. When that branch exists already, stop and name it: `/bdk:debug` runs on the fix's own branch then. On any other branch, stay: the fix belongs to that branch.
2. Run **commit** with the arguments `only openspec/changes/<change>/: the fix Change <change>`.
3. `git status --porcelain` must print nothing now; otherwise stop and name what is left, since `execute` needs a clean tree.

Done when the Change is committed on the fix's branch and the tree is clean.

## 6. Build the fix

Run **execute** with `<change>`. Then read the first line of `R/execute/result.md`:

- `Status: done`: step 7.
- `Status: blocked` or no file: go to step 8 with `Status: blocked` and the blockers as `execute` reported them, with `/bdk:execute <change>` (or `/bdk:debug <change>`) to continue. A plan defect in the part means the diagnosis was wrong: name `diagnose-bug` and the part.

Done when the part is built, or you have the blocker.

## 7. Review the fix

Run **auto-review** with `<change>`. When it stops for triage (manual review gate) without a `R/review/result.md`, stop as well: `/bdk:debug <change>` continues once the findings are decided. Otherwise go to step 8.

Done when `R/review/result.md` exists, or you stopped for triage.

## 8. Write the result

Write `R/debug/result.md`, replacing an earlier one, from the files (Read and Grep, not from memory):

```markdown
Status: done

## Bug
- Report: tally total crashes after tally add 5
- Reproduction: debug/reproduction.md (tools.e2e cli)
- Root cause: bin/tally.js:15 `add` stores the text, so `total` sums strings

## Fix
- Test: tally / Requirement: Total / Scenario: Total after an add -> test/tally.test.js; red seen; green seen
- Changed files: bin/tally.js, test/tally.test.js
- Commits: 3f2c1a0 fix(tally): store parsed amounts; 9b1e7d2 docs(openspec): fix Change fix-total-crash

## Review
- Status: done
- Rounds: 1 (0 findings)

## Blockers
- None.

## Decisions taken without the user
- Gate: policy.gates.design auto.
```

- `Status: done` only when `execute/result.md` and `review/result.md` both read `Status: done`; else `Status: blocked`.
- `## Fix`: the `## Acceptance tests` lines and `## Changed files` of `R/execute/part-01.md`; the commits from `git log --oneline <base>..HEAD`.
- `## Review`: the first line of `review/result.md` and its `## Rounds` lines.
- `## Blockers`: each with the command that continues it.
- `## Decisions taken without the user`: the auto gate, and the lines under that heading in the part report, the execute result and the review result.
- An empty section holds `- None.`

Done when the result exists and its first line is the status.

## 9. Reply

Reply with the status line, the result path, the root cause in one line, the reproduction test and whether it was seen red then green, and the review outcome. On `Status: done` name the next step `/bdk:close <change>`, which checks the specs, archives the Change and opens the pull request; on `Status: blocked` each blocker with its command. Never say the bug is fixed while the part or the review is blocked.
