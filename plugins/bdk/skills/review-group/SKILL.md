---
name: review-group
description: 'Reviews one group of changed files of a BDK review round - behaviour against the plan part and spec scenarios, tests that cannot fail, review rules and the project instructions (CLAUDE.md, AGENTS.md, .claude/rules), security - and appends each problem to the round findings log with bdk findings add. Use when a review round or a user asks to review a group (p01, unplanned, m1) of a round directory, or to review the files of a branch or a plan part without fixing them.'
argument-hint: "[<round-dir> <group-id>] [--base <ref>] [--workdir <path>] [--change <path>|none] [--intent <file>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git symbolic-ref *) Bash(git rev-parse *) Bash(git -C *) Bash(cd *) Read Grep Glob
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Review a group

Find the problems inside one group of files and append each to the round's findings log. You change no file, run no test, linter or build (the round runs the checks once), set no level and start no agent. Run every `bdk` call as the steps write it, `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` and each argument written out, as the whole Bash command: nothing before or after it, no `cd`, `;`, `&&`, `|` or `echo`, no shell variable. The permission rule allows `bdk` only on its own, so another form can be denied, and a denied call ends the block. The `--workdir` form below is the one exception. Read and list files with Read, Grep and Glob, not through Bash.

If the block above says "BDK not configured: run /bdk:setup", stop and pass that line on. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## Another checkout, Change or intent

A caller that reviews code outside the working directory (`/bdk:pr-review` reviews a pull request in its own worktree) adds up to three inputs. Without them, skip this section.

- `--workdir <path>`: the checkout to review. Give every Read, Grep and Glob call an absolute path under it, and read the Change, the plan parts and the project instructions there too; run git as `git -C <path> <command>` (the host refuses `cd` followed by `git`) and `bdk` as `cd <path> && "${CLAUDE_PLUGIN_ROOT}/bin/bdk" <command>`, one command per call. Never read the same paths in the working directory: that is another commit. The round directory and its log stay where the arguments say.
- `--change <path>`: the Change directory, relative to the work directory (`openspec/changes/archive/2026-10-01-monthly-report` for an archived one), in place of `openspec/changes/<change>/`. `--change none`: the range carries no Change.
- `--intent <file>`: what the author meant (a pull request's title, description and linked issues). Read it whole as part of the contract in step 2, next to the plan part and the scenarios, or in their place when there is no Change.

## 1. Find the round and the group

With a round directory in the arguments or the request (`.bdk/runs/<change>/review/round-<N>/`), use it and the group id given with it. Otherwise prepare a manual round:

1. The round directory is `.bdk/runs/manual/review/round-<N>/`, `N` the lowest number whose directory holds no `review.md` (1 when there is none).
2. When it holds no `groups.json`, record the groups: `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" git groups <base> --rounds .bdk/runs/manual/review --record <round-dir>`, adding `--plan openspec/changes/<change>/plan/parts` when `openspec/changes/` holds exactly one Change besides `archive/`. `<base>` is the `--base` given, else the branch `git symbolic-ref --short refs/remotes/origin/HEAD` names, else `main`.
3. Without a group id, review every group except `integration`, one after another, from step 2 on.

Read `groups.json` in the round directory: `range`, and the `files` of your group. The log is `<round-dir>/findings.jsonl`. The Change is `openspec/changes/<change>/`, where `<change>` is the directory under `.bdk/runs/` (none for `manual` unless step 2 found one). A group `p<NN>` has the plan part `plan/parts/<NN>.md` of the Change; when that file does not exist, the part is a fix part of an earlier review round, `.bdk/runs/<change>/review/round-<k>/fixes/parts/<NN>.md`. `integration` belongs to `review-integration`, not to you.

When `groups.json` has an `anchor` of `kind` `round`, this round reviews the fixes made since round `anchor.round`: keep that round's log, `.bdk/runs/<change>/review/round-<anchor.round>/findings.jsonl`, for step 3.

Done when you know the range, the group's files, the log, the part file if there is one, and, in a fix round, the earlier round's log.

## 2. Read the contract

Read the plan part: its goal, acceptance scenarios and tasks. Read each spec scenario it names in `openspec/changes/<change>/specs/`. Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" rules for --stage review --files <file> --files <file> ...` with every file of the group and keep the rules it prints. Read the project instructions that bind the group's files: `CLAUDE.md` and `AGENTS.md` in the project root and in each directory on the way to a file of the group, and each `.claude/rules/*.md` whose `paths` match one of them or that has no `paths`. Keep each instruction with the path of its file relative to the project root (`CLAUDE.md`, `src/AGENTS.md`, `.claude/rules/testing.md`). Without a part, the contract is the spec scenarios that name the group's code, and the commit subjects of the range (`git log --format=%s <range>`).

Done when you can say, for each file, what it must do and which rules and instructions bind it.

## 3. Review each file

For each file of the group: read it whole, then its diff (`git diff <range> -- <file>`), then the tests that cover it (Grep for the changed names). Check, in this order:

1. **Behaviour.** The code does what the tasks and scenarios say for every input they allow: boundaries, empty and missing values, signs and units, error paths. Trace a concrete input through the code and compare the result with the scenario.
2. **Tests.** Each changed behaviour has a test that would fail if the behaviour broke. A test that cannot fail, or that only covers inputs where the bug does not show, is a problem; name the input it misses.
3. **Rules and instructions.** Each rule and each project instruction from step 2 that the changed lines break. An instruction that names what else must change with the file (a doc, a list, a test) is checked here too: read that file for it.
4. **Security.** Input from outside the process reaching a query, a shell, a file path or an eval without a check.
5. **Fixed findings.** For a fix part, each task names the finding it fixes. Read that finding in the earlier round's log (`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <earlier log>`) and trace its failure scenario through the code as it is now. A failure that still happens is a finding; its evidence names the earlier id and the input that still fails.

Leave formatting and style a linter checks to the linter. A problem you can only see with a file outside the group (a caller, the other side of a contract) belongs to `review-integration`; leave it.

Done when every file of the group is read and checked.

## 4. Append the findings

One call per problem:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings add <log> --source review-group --file <path> --line <n> --summary "<one line: what is wrong>" --evidence "<failure scenario>" [--rule <id or instruction file>]
```

- `--evidence` is the failure scenario: the input and the wrong result ("`parse('7')` gives 7, the scenario needs 700"), or the change that would break the behaviour while every test passes. For a problem without a failure, name what it costs.
- `--line` is where the fix goes. `--rule` only when the finding is the violation of a rule or an instruction from step 2: the rule's id, or the instruction file's path relative to the project root (`--rule CLAUDE.md`). For an instruction, the evidence quotes it and names the changed line that breaks it; when one line breaks two instructions of the same file, one finding names both.
- One finding per problem; the same problem on several lines is one finding on the first.

Done when every problem has its line in the log (each call prints the finding id).

## 5. Verify and return

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <log>` and check that each id you added is listed with the source `review-group`. Return only: the group, the number of findings you added, and their ids with summaries, one per line; "no findings" when there were none.
