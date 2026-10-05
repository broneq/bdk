---
name: commit
description: Commits the user's changes with a Conventional Commits message written from the diff and the project's own commit convention. Use when the user asks to commit, or for a commit message for their changes.
argument-hint: "[paths or scope to commit, e.g. 'only src/auth']"
allowed-tools: Bash(bdk *) Bash(echo *) AskUserQuestion Read Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git add *) Bash(git commit *)
disallowed-tools: Edit Write NotebookEdit
---

!`bdk ctx skill commit 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: commit" heading appears above, run `bdk ctx skill commit` first and apply its output; on a `BDK STOP` line, stop and report it.

# Commit

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

Commit the user's own changes with a message that follows the project's convention. Done when one commit exists and you have reported its hash and subject, or when a hook rejected it for a reason you cannot fix in the message.

This skill is for the user's commits. The task commits and the review fixes of a BDK Change go through `bdk commit`, which `/bdk:execute` and `/bdk:cr` run with the BDK trailers; never use this skill for them, and add no BDK trailer here.

## 1. Choose what to commit

Run `git status --short`.

- When something is staged, commit exactly that. Mention unstaged changes in the report, and leave them alone.
- When nothing is staged and the argument names paths or a scope, run `git add` for those paths only.
- When nothing is staged and there is no argument, show the changed and untracked paths and ask which to stage. Never stage everything unasked: an untracked file can be a secret or a local artefact.

Stop and report when nothing is left to commit.

## 2. Find the project's convention

Look in this order and take the first source that states a convention:

1. A commitlint configuration at the repository root (`commitlint.config.*`, `.commitlintrc*`, or a `commitlint` key in `package.json`): its types, scopes, case rules and header length.
2. `CONTRIBUTING.md`: its section on commits.
3. The subjects of `git log --format=%s -20`: the types and scopes the project already uses, and its subject style.

A limit the project sets wins over every default below.

## 3. Write the message

Read the staged diff with `git diff --staged`, and `git diff --staged --stat` first when it is large.

Write the message in the Conventional Commits form:

```
<type>(<scope>): <subject>

<body>
```

- `type`: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci` or `chore`, unless the project allows other types. One commit has one type. When the diff mixes unrelated changes, say so and offer to split it.
- `scope`: the module or area the change touches, in the project's spelling. Leave it out when the change has no single area.
- `subject`: imperative, lower case, no final period, at most 72 characters, or the project's header limit.
- `body`: why the change was made and what it changes for a reader, wrapped at the project's line length (default 100). Leave it out only for a change whose subject says everything.
- A breaking change gets `!` after the scope and a `BREAKING CHANGE:` footer.
- Add no co-author, tool or agent attribution, unless the project's convention asks for one.

## 4. Commit

Run `git commit` with the message, passed as one `-m` per paragraph or through a heredoc. Never pass `--no-verify`: the user's hooks are part of the commit.

- When a hook rejects the message (commitlint and the like), fix the message to satisfy it and commit once more.
- When a hook rejects for any other reason (lint, tests, a formatter that changed files), report its output and stop; the fix is the user's call.

Report the hash and the subject, and name anything left unstaged.
