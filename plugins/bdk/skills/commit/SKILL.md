---
name: commit
description: Commits the user's changes with a message in the project's own convention (commitlint, CONTRIBUTING.md, history; Conventional Commits otherwise), staging only what belongs to the change and keeping secrets and local files out. Use whenever the user asks to commit, to commit their changes or work, or for a commit message, and when another BDK skill needs a commit made.
argument-hint: "[paths, scope or intent, e.g. 'only src/auth' or 'one commit for the archived Change']"
allowed-tools: Bash(git *) Read Glob Grep
---

Arguments: $ARGUMENTS

# Commit

Done when every change you picked is committed with a message in the project's convention, and you have reported each commit's hash and subject, what you left out, and what stays unstaged. Run each `git` command on its own, without `;`, `&&` or pipes; read files with Read, Glob and Grep, not with `cat`. Never pass `--no-verify`, never amend a commit unless asked, never push.

## 1. Choose what to commit

Run `git status --short`.

- **Something is staged:** commit exactly that, as one commit. Name what stays unstaged in the report and leave it alone.
- **The arguments name paths, a scope or how to group the commits:** stage only those paths, grouped as asked.
- **Nothing is staged, no arguments:** pick the files yourself, without asking. Read `git diff` and the new files.
  - Take the tracked changes and the new files they use or test (an imported module, its test).
  - Never stage a file that looks like a secret or a local artefact: `.env*`, keys and certificates (`*.pem`, `*.key`, `id_*`), credentials and tokens, logs, editor and OS files, build output, dumps. Leave other untracked files out unless the change uses them. List every file you left out in the report.
  - When the picked changes do unrelated things (a docs typo next to a bug fix, two separate features), make one commit per concern, staging each group by path.

Stage by path (`git add <path> ...`), never with `git add -A`, `git add .` or `git add --all`. Stop and say so when nothing is left to commit.

Done when you know the commits to make and the paths of each.

## 2. Find the convention

Take the first source that states one:

1. A commitlint configuration at the repository root (`commitlint.config.*`, `.commitlintrc*`, a `commitlint` key in `package.json`): its types, scopes, case rules and header length.
2. The section on commits in `CONTRIBUTING.md`.
3. The subjects of `git log --format=%s -20`: the types, scopes and subject style the project uses.

Without any, use Conventional Commits. A rule the project sets wins over every default below.

Done when you know the allowed types and scopes, the header limit and the subject style.

## 3. Write each message

Read the staged diff of the commit (`git diff --staged`; `git diff --staged --stat` first when it is large).

```
<type>(<scope>): <subject>

<body>
```

- `type`: by default `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci` or `chore`; the project's own list when it has one. One commit, one type.
- `scope`: the area the change touches, in the project's spelling; required or limited when the project says so, otherwise left out when there is no single area.
- `subject`: imperative, lower case, no final period, within the project's header limit (72 characters by default).
- `body`: why the change was made and what it changes for a reader. Leave it out only when the subject says everything.
- A breaking change gets `!` after the scope and a `BREAKING CHANGE:` footer.
- No `Co-Authored-By`, tool or agent line unless the project's convention shows one (a commitlint rule, `CONTRIBUTING.md`, or such trailers in recent commits). The message is the project's record, and its convention decides its shape.

Done when each message passes every rule of step 2.

## 4. Commit

For each commit: stage its paths, then run `git commit -F -` with the message on standard input (a heredoc), or one `-m` per paragraph.

- A hook rejects the message (commitlint and the like): fix the message and commit again.
- A hook rejects for any other reason (lint, tests, a formatter that changed files): report its output and stop. The fix is the user's call.

Then run `git log --oneline -<number of commits>` to confirm.

## Report

One line per commit: hash and subject. Then the files you left out and why, and anything still unstaged.
