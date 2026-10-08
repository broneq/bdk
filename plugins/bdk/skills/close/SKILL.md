---
name: close
description: 'Closes a reviewed OpenSpec Change - commits work left in the tree, checks the spec deltas with spec-conformance on bdk:verifier, archives the Change into the main specs, commits the archive, pushes the branch and opens a pull request into the base branch (no stacking). Stops before the archive when the specs do not match the product. Resumes from its first missing step. Use when a Change is reviewed and ready to ship, when asked to "close", "finish" or "open the PR for" a Change, or when /bdk:run reaches the close stage.'
argument-hint: "[change-name] [--base <branch>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git status *) Bash(git symbolic-ref *) Bash(git rev-parse *) Bash(git branch *) Bash(git switch *) Bash(git log *) Bash(git push *) Bash(openspec archive *) Bash(gh pr view *) Bash(gh pr create *) Read Glob Grep Write Skill Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Close

You compose the steps that end a Change: commit, check, archive, commit, push, pull request. You never do a block's work: you do not check the specs yourself, write a commit message yourself, or edit a spec delta, a main spec or code - not even to make a check pass. You never rebase, reset, amend, force-push or merge. The only files you write are `.bdk/runs/<change>/close/pr-body.md` and `.bdk/runs/<change>/close/pr.md`. Run each command on its own, without `;`, `&&` or pipes.

The blocks:

- **commit**: call the Skill tool with `bdk:commit` and the arguments this skill gives. It stages by path, follows the project's commit convention and reports the commits.
- **spec-conformance**: start an agent with the Agent tool, `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:spec-conformance with the arguments: <change> --base <diff base>`, where the diff base is `origin/<base>` when `git rev-parse --verify --quiet origin/<base>` prints a commit, else `<base>`: the pull request compares with the remote base, and a local base may already hold the Change's commits. It writes `.bdk/runs/<change>/close/spec-conformance.md` and returns its verdict line.

Before each step, tell the user in one line what runs and what it writes, e.g. `Checking the specs: bdk:verifier writes .bdk/runs/add-csv-export/close/spec-conformance.md`.

## 1. Check the configuration and the Change

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: run nothing else and reply with that line.

- **Change**: the first argument. Without one: the only directory under `openspec/changes/` other than `archive/`; else the `current` Change of `.bdk/runs/run.json`. With none or several, name what you found and stop. The Change is **archived** when `openspec/changes/<change>/` is gone and a directory `openspec/changes/archive/<date>-<change>/` exists; that is a resumed close, not an error.
- **Base**: `--base <branch>` when given; else `git symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/` prefix; else `main`.
- **Branch**: `git branch --show-current`. When it prints the base or nothing (detached `HEAD`), run `git switch -c <change>`: every Change gets its own branch, and the base keeps its commits. When that branch exists already, stop: name it, and say that `/bdk:close` runs on the Change's branch.

When `.bdk/runs/run.json` exists and queues the Change, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" run status --json` and read the Change's entry:

- stage `propose`, `design`, `plan`, `execute` or `auto-review`: stop, run nothing, and name the stage, its reason and its command (`/bdk:<stage> <change>`);
- stage `done`: reply with the first line of `.bdk/runs/<change>/close/pr.md` and stop;
- stage `close`: go on.

Without `run.json`, the user's command is the consent to close: go on.

Done when you hold the Change, the base and the branch, and you are on the branch.

## 2. Find where to start

Take the first row that matches:

| # | State | Start at |
|---|---|---|
| 1 | the Change is not archived | step 3 |
| 2 | archived, and `git status --porcelain -- openspec/` lists changes | step 5 |
| 3 | archived and committed | step 6 |

A step whose result exists never runs again. A Change that is not archived is checked again even when an earlier report passed: the code may have changed since, and the verifier carries the earlier IDs over.

## 3. Commit the work, then check the specs

1. Run `git status --porcelain`. When it lists anything, run **commit** with the arguments `the work of Change <change> left in the tree`: the verifier reads `git diff <base>...HEAD`, so uncommitted work would be invisible to it.
2. Run **spec-conformance** and wait for it. Read the first line of `.bdk/runs/<change>/close/spec-conformance.md`.
3. `Verdict: PASS`: go to step 4. Anything else, or no report: stop here. Archive nothing, commit nothing more, push nothing. Read the report's `## Must address` section and reply with the verdict, the report path, each `Must address` ID with one line on which side it names (the code, or the spec deltas of the Change), and that `/bdk:close <change>` runs again after the fix.

Done when the report passes, or you stopped.

## 4. Archive

Run `openspec archive <change> --yes`. It merges the spec deltas into `openspec/specs/` and moves the Change to `openspec/changes/archive/<date>-<change>/`; a Change with `skip_specs: true` is archived the same way. When it exits non-zero, stop: quote its error, commit nothing, push nothing.

Done when the archived directory exists.

## 5. Commit the archive

Run **commit** with the arguments `only openspec/: one commit for the archived Change <change>`. Then `git status --porcelain -- openspec/` must print nothing; when it does, report what is left and stop.

Done when the archive is committed.

## 6. Push

Run `git push -u origin <branch>`, never with `--force` or `--force-with-lease`. When it fails (no `origin`, rejected, no access), stop: quote the error and say that the Change is archived and committed locally, and that `/bdk:close <change>` pushes and opens the pull request once the cause is fixed. Do not rebase or pull to make a push pass: a branch behind its remote is the user's to resolve.

Done when the push succeeded.

## 7. Open the pull request

Run `gh pr view <branch> --json url,state`. When it prints an open pull request, reuse its URL and go to step 8.

Otherwise gather the body from files (Read and Grep, not from memory):

- What the Change does: the Why and What Changes of the archived `proposal.md`, in a few lines.
- `Resolves #<n>` when the issue is known: the Change's `issue` in `.bdk/runs/run.json`, else the issue the first line under Why names (`Tracks #42.`).
- Specs: the capabilities whose main specs the archive changed (`openspec/specs/<capability>/`), and the spec-conformance verdict line.
- E2E: the first line of `.bdk/runs/<change>/e2e/verdict.md`, or `no E2E results`.
- Review: the number of `.bdk/runs/<change>/review/round-N/` directories, or `no review round ran`.
- Decisions taken without the user: the bullets under `## Decided without the user` of `proposal.md` and every line of `design.md` that starts with `Decided without the user:`, or `none`.

Write the body to `.bdk/runs/<change>/close/pr-body.md`. The title says what the Change does, in the style of the project's commit subjects (`git log --format=%s -10`). Run:

`gh pr create --base <base> --head <branch> --title "<title>" --body-file .bdk/runs/<change>/close/pr-body.md`

When `gh` fails (not logged in, no repository), stop: quote the error, write no `pr.md`, and say that `/bdk:close <change>` opens the pull request once the cause is fixed.

Done when you hold the pull request URL.

## 8. Record and report

Write `.bdk/runs/<change>/close/pr.md` last, because `bdk run status` reads its existence as "PR opened":

```markdown
PR: https://github.com/acme/shop/pull/17
Base: main
Branch: add-csv-export

<the body of the pull request>
```

Reply in a few lines:

- the pull request URL and its base branch;
- the archive path and each commit this close made (hash and subject, from `git log --oneline <base>..HEAD` or the commit reports);
- the spec-conformance verdict;
- every decision taken without the user, as in the body.

End your turn there. The pull request waits for the user's review; you do not merge it.
