# bdk-cli/hooks Specification

## Purpose

Defines the `bdk hooks` commands that the `bdk` plugin's Claude Code hooks call: the `SessionStart` context or warning and the optional `PreToolUse` guard `hooks.subagent-git`, which keeps worker subagents from changing git history, and how the plugin registers them.

## Requirements

### Requirement: Hook registration

`plugins/bdk/hooks/hooks.json` SHALL register exactly two hooks: a `SessionStart` hook running `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start -`, and a `PreToolUse` hook with the matcher `Bash` running `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks pre-tool-use -`. A failure of the `pre-tool-use` command (a missing bundle, a missing or too old Node, any non-zero exit) SHALL NOT block the tool call: the hook exits 1, which the host reports and ignores. A failure of the `session-start` command SHALL be shown to the user: the hook exits 2. `claude plugin validate plugins/bdk --strict` SHALL pass with the file in place.

#### Scenario: Registered events

- **WHEN** `plugins/bdk/hooks/hooks.json` is read
- **THEN** it holds a `SessionStart` entry and a `PreToolUse` entry with matcher `Bash`, both calling `dist/bdk.mjs` under `${CLAUDE_PLUGIN_ROOT}` with `hooks <verb> -`, and no other event

#### Scenario: Broken guard does not block

- **WHEN** the `PreToolUse` hook command runs in a plugin directory without `dist/bdk.mjs`
- **THEN** it exits 1, not 2

### Requirement: Hook payload input

Both `bdk hooks` commands SHALL take one required argument, `-`, and read the host's hook payload, one JSON object, from stdin. Any other argument value SHALL be the usage error `usage/invalid-argument`. A payload that is not a JSON object SHALL be the usage error `usage/invalid-payload`. A field the command reads that is absent or of another type SHALL count as absent.

#### Scenario: Payload not JSON

- **WHEN** `bdk hooks pre-tool-use -` reads `not json` from stdin
- **THEN** it reports `usage/invalid-payload` and exits 2

#### Scenario: Argument other than -

- **WHEN** `bdk hooks session-start payload.json` runs
- **THEN** it reports `usage/invalid-argument` and exits 2

### Requirement: Hook output

Without `--json`, a `bdk hooks` command SHALL print on stdout exactly one JSON object in the host's hook output format, and exit 0 for every decision, a denial included: the host reads hook output only on exit 0, so the CLI's exit code 1 is never used by this group. With `--json`, it SHALL print its own result instead, valid against the command's output schema.

#### Scenario: Deny exits 0

- **WHEN** `bdk hooks pre-tool-use -` denies a command
- **THEN** stdout holds the host's deny object and the exit code is 0

#### Scenario: Allow prints an empty object

- **WHEN** `bdk hooks pre-tool-use -` allows a command
- **THEN** stdout is `{}` and a newline, and the exit code is 0

### Requirement: Session start context

`bdk hooks session-start -` SHALL resolve the configuration of the project around the payload's `cwd` (the hook's working directory when absent), as `bdk-cli/config` "Configured project" defines it. In a configured project with a valid configuration, it SHALL add a short BDK context for the model through `hookSpecificOutput.additionalContext` with `hookEventName` `SessionStart`. The context explains how work is done in a BDK project, so that the main session picks the right `/bdk:*` command or edits directly before any skill runs. It SHALL be at most six lines and SHALL say, in this order:

1. that BDK is configured in this project, and the project root;
2. that work with behaviour to specify runs as an OpenSpec Change through the stages `/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review` and `/bdk:close`, named in this order;
3. that `/bdk:run` carries an intent or a list of issues through every stage to a pull request, `/bdk:debug` fixes a reported bug that needs diagnosis, and `/bdk:pr-review` reviews a pull request;
4. that a stage that stopped resumes from its files, so running the same command again continues it;
5. that a small edit that can be seen whole (a typo, a version bump, a one-line fix) is done directly, without a Change.

Apart from the project root, the context SHALL be the same text in every configured project, whatever its settings and whatever its state under `.bdk/runs/` and `openspec/changes/`. It SHALL NOT name `bdk` CLI commands or settings keys. It SHALL show the user nothing.

#### Scenario: Configured project

- **WHEN** the session starts in a project with `.bdk/settings.yaml` and `openspec/`, and a valid configuration
- **THEN** stdout holds `hookSpecificOutput` with `hookEventName` `SessionStart` and an `additionalContext` of at most six lines that names BDK and the project root, names `/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review` and `/bdk:close` in this order, names `/bdk:run`, `/bdk:debug` and `/bdk:pr-review`, says that a stage continues when its command runs again and that a small edit is done directly without a Change; there is no `systemMessage`, and the exit code is 0

#### Scenario: No CLI pointers

- **WHEN** the session starts in a configured project with a valid configuration
- **THEN** the `additionalContext` contains neither `bdk config show` nor `bdk --help`

#### Scenario: Guard on

- **WHEN** the configured project sets `hooks.subagent-git: true`
- **THEN** the `additionalContext` is the same text as in the same project without that setting, and does not contain `hooks.subagent-git`

#### Scenario: Same text whatever the run state

- **WHEN** the session starts in a configured project that holds `.bdk/runs/run.json` and an open Change under `openspec/changes/`
- **THEN** the `additionalContext` is the same text as in the same project without them

### Requirement: Session start warning without configuration

When the project is not configured, `bdk hooks session-start -` SHALL show the user exactly one warning through `systemMessage`, `BDK not configured: run /bdk:setup`, and add nothing to the model's context. When the configuration is invalid, the one warning SHALL be `BDK configuration invalid: run bdk config check`, again with nothing added to the context.

#### Scenario: Session without configuration

- **WHEN** the session starts in a project without `.bdk/settings.yaml`
- **THEN** stdout is exactly `{"systemMessage":"BDK not configured: run /bdk:setup"}` and a newline, and the exit code is 0

#### Scenario: Invalid configuration

- **WHEN** the session starts in a configured project whose project layer sets `execution.lead: sideways`
- **THEN** stdout holds only a `systemMessage` `BDK configuration invalid: run bdk config check`, and no `hookSpecificOutput`

### Requirement: Subagent git guard

`bdk hooks pre-tool-use -` SHALL deny a tool call when all of these hold, and allow every other call:

1. the payload's `tool_name` is `Bash`;
2. the payload has an `agent_id`, so the call comes from a subagent (the main thread has none, also when it runs as an agent with `--agent`);
3. the payload's `agent_type` is not `bdk:lead`;
4. `tool_input.command` changes git history (see "Git history changes");
5. the project around the payload's `cwd` is configured, its configuration is valid, and `hooks.subagent-git` is `true`.

A denial SHALL print `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":<reason>}}`, where the reason names the setting `hooks.subagent-git`, the git command it matched, and what to do instead: leave the changes in the working tree and report them, because the lead or the main thread commits. The guard SHALL read the configuration only when conditions 1 to 4 hold.

#### Scenario: Worker commit refused

- **WHEN** a subagent of type `general-purpose` runs `git add -A && git commit -m wip` in a configured project with `hooks.subagent-git: true`
- **THEN** the command is denied with a reason naming `hooks.subagent-git` and `git commit`

#### Scenario: Lead commit passes

- **WHEN** a subagent of type `bdk:lead` runs `git commit -m "part 01"` in the same project
- **THEN** the command is allowed

#### Scenario: Main thread passes

- **WHEN** the main thread (no `agent_id`) runs `git commit -m x` in the same project
- **THEN** the command is allowed

#### Scenario: Guard off by default

- **WHEN** a worker subagent runs `git commit -m x` in a configured project that does not set `hooks.subagent-git`
- **THEN** the command is allowed

#### Scenario: Unconfigured project

- **WHEN** a worker subagent runs `git commit -m x` in a project without `.bdk/settings.yaml`
- **THEN** the command is allowed

#### Scenario: Read-only git passes

- **WHEN** a worker subagent runs `git status && git diff HEAD~1 && git log --oneline` with the guard on
- **THEN** the command is allowed

### Requirement: Git history changes

A Bash command SHALL count as changing git history when any of its simple commands is a git invocation of a form in the table below. The command SHALL be read as a shell reads it, best effort: split into simple commands on `;`, `&`, `&&`, `|`, `||`, newlines, grouping and function bodies (`function f { ... }`, `f() { ... }`); quoted text and heredoc bodies kept out of command words; leading variable assignments and the wrappers `env`, `command`, `exec`, `time`, `timeout`, `nice`, `nohup` and `sudo` dropped, with their options; read as commands again, up to three levels deep: the string of `sh -c`/`bash -c` (any shell of `sh`, `bash`, `zsh`, `dash`, after its other options and their values), of `eval` and of `env -S`, the heredoc bodies a shell without `-c` or a script file reads, and the content of `$(...)` and backtick substitutions. A git invocation is a simple command whose command word has the base name `git`; its subcommand is the first word after git's global options, skipping the value of `-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace` and `--super-prefix`.

| Subcommand | Changes history when |
| --- | --- |
| `commit`, `merge`, `rebase`, `cherry-pick`, `revert`, `reset`, `am`, `pull`, `push`, `update-ref`, `replace`, `filter-branch`, `filter-repo` | always, except `push` with `-n`/`--dry-run` |
| `stash` | its next word is not `list` or `show` |
| `branch` | it has a delete, move, copy, force or upstream option (`-d`, `-D`, `-m`, `-M`, `-c`, `-C`, `-f`, `-u` and their long forms, `--unset-upstream`, `--edit-description`) or names a branch, and has no `-l`/`--list`/`--show-current` |
| `tag` | it has `-d`, `-a`, `-s`, `-f`, `-m`, `-F`, `-u` or their long forms, or names a tag, and has no `-l`/`--list`/`-v`/`--verify` |
| `checkout`, `switch` | it creates a branch: `checkout` with `-b`, `-B`, `-t`, `--track` or `--orphan`; `switch` with `-c`, `-C`, `-t`, `--track`, `--create`, `--force-create` or `--orphan` |
| `fetch` | a refspec operand writes a local ref other than a remote-tracking one (`main:main`) |
| `worktree` | it is `worktree add` with `-b` or `-B` |
| `notes` | its first operand (after `--ref <ref>`) is not absent, `list`, `show` or `get-ref` |
| `reflog` | its next word is `expire` or `delete` |
| `symbolic-ref` | it has `-d`/`--delete`, or two operands |

A git invocation with the word `-h` or `--help` never changes history. Git aliases, commands built at run time (a variable as the command word), a function called by its name, text piped into a shell, git run from another program (`xargs`, `find -exec`, a script file), and a branch `git switch <name>` creates implicitly from a remote branch SHALL NOT be recognised; the guard stops a careless agent, not a determined one.

#### Scenario: Quoted text is not a command

- **WHEN** a worker runs `echo "git commit -m x" && grep -r "git reset" .` with the guard on
- **THEN** the command is allowed

#### Scenario: Global options and wrappers

- **WHEN** a worker runs `GIT_EDITOR=true env -u X /usr/bin/git -C ../repo -c user.name=a commit --amend` with the guard on
- **THEN** the command is denied, matching `git commit`

#### Scenario: Nested shell and substitution

- **WHEN** a worker runs `bash -lc 'cd x && git stash'`, or `echo $(git stash create)`, with the guard on
- **THEN** each command is denied, matching `git stash`

#### Scenario: Shell options, heredocs and wrappers

- **WHEN** a worker runs `bash -o pipefail -c 'git commit -m x'`, `timeout 300 git push`, or `bash` with a heredoc body `git reset --hard`, with the guard on
- **THEN** each command is denied

#### Scenario: Listing forms pass

- **WHEN** a worker runs `git branch -a && git branch --list 'v3/*' && git tag -l && git stash list && git notes show HEAD` with the guard on
- **THEN** the command is allowed

#### Scenario: Ref-creating forms refused

- **WHEN** a worker runs `git branch topic`, `git tag v1`, `git checkout -b topic` or `git worktree add -b topic ../t` with the guard on
- **THEN** each command is denied
