## MODIFIED Requirements

### Requirement: Invocation

The kernel SHALL accept exactly one argument form, reached through two entry points, and resolve its project root, active Change and flags as follows.

- **Entry points.** Agents and skills run the kernel as `bdk <args>`: the plugin's `bin/bdk` launcher (`kernel-architecture`, Plugin launcher) is on the `PATH` of the Bash tool in the main thread and in a subagent, and of a skill's `!` block (HOST-FACTS `plugin-bin-bash`, `plugin-bin-subagent`, `plugin-bin-skill`). Hooks run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <args>`, because a plugin's `bin/` is not on a hook's `PATH` (HOST-FACTS `plugin-bin-hook`); tests and the eval harness run the bundle by its path as well. Both entry points run the same bundle with the same arguments, and the kernel's behaviour does not depend on which one started it. Every `bdk ...` command the kernel prints (`instead`, the `doneBy.command` of a graph kind, `--help`) is runnable as written by an agent. A host that does not install a plugin's `bin/` (claude.ai, Cowork) is not supported.
- **Form.** `bdk <group> [<verb>] <positional...> [--flag [value]]`. Groups and verbs are lowercase words. A mandatory choice that changes the command's meaning is a positional literal (`attempt close A-7f3k ok`, `config set --global` being the one flag-shaped exception because the layer is a target, not a meaning); optional inputs and switches are flags. Flags never repeat a positional. Boolean flags take no value. A flag is given at most once unless its index record marks it `repeatable` (`log add --ref`, `change park --option`); a repeatable flag collects its values in order, and `--help` shows it as repeatable. `--skip-verify` is not a CLI flag anywhere: it reaches the kernel only inside the `UserPromptExpansion` payload (P2).
- **Project root.** The kernel walks up from the working directory to the nearest directory containing `.bdk/`; without one, the git work tree root is the project root and `.bdk/` is created by the first writing command (`config set` from `/bdk:setup`). Inside a kernel part worktree (`kernel-state`, Part worktree), whose git directory holds the home marker `bdk-home`, the project root is the home checkout the marker names and the active Change is the one it names, so a command run from a part's worktree reads and writes the one ledger of the home checkout; a marker naming a directory that is no longer a work tree of the same repository refuses with `state/worktree-orphaned` and `instead: bdk rebuild` run from the home checkout. Every command except the standalone ones requires the project root to be inside a git work tree (`runtime/not-a-repo` otherwise) and Node at or above the minimum (`runtime/node-version`). Four commands are standalone and need no work tree: `version`, so `doctor` and the wrapper's STOP line can always quote it; `ctx startup` and `hooks session-start`, because the host runs the SessionStart hook in any directory and a session outside a repository must get the STARTUP text, not a STOP line (outside a work tree `hooks session-start` prints STARTUP only, `kernel-cli/hooks`); `hooks pre-tool`, because the host runs the PreToolUse hook in any directory and its guards read only the payload, so a tool call outside a repository must not be blocked with `runtime/not-a-repo`. The standalone commands still require the Node minimum, except `version`. `doctor` needs the work tree but not the Node minimum: it reports a Node below the minimum as a `fail` finding and exits 0 (`kernel-cli/service`, `bdk doctor`), because diagnosing that Node is its job. The bundle is built for the minimum line and loads `node:sqlite` only when a command opens the index, so a Node below the minimum that still loads the bundle (22.x before 22.13, 23.x before 23.4) reaches the kernel's own check and gets the refusal with the install line. Older lines (20 and below) are not supported and may fail in the module loader; the wrapper forms of Output modes turn that into a STOP line in inject mode and a block in guard mode.
- **Active Change.** Every Change-scoped command resolves the active Change from the current git branch: one active Change per branch (Key boundaries, hooks table). No command takes a `--change` flag in contract version 3; cross-Change reads use the qualified reference `<changeId>/<id>` (`kernel-cli`, Conventions). The binding is a local marker per branch (`kernel-state`, Branch binding); the current branch is read from `HEAD`, and a detached `HEAD` has no active Change. Without an active Change the command exits 2 with `policy/no-active-change` and an `instead` that names `/bdk:change new` and `bdk change resume <id>` (with the ids of the unarchived Changes when there are any); a marker naming a Change whose directory is gone is `state/change-dir-missing`.
- **`--json`.** Every command accepts `--json` and then prints exactly one JSON object on stdout, validated by its schema under `schema/cli/output/`. Without `--json` the same data is rendered as text. Only the JSON form is a contract; skills and tests that parse output use `--json`. Inject-mode commands (`kernel-cli`, Output modes) print Markdown by default and, with `--json`, the same content as an object (`content` plus the parts it was composed from) while still exiting 0; the `!` wrapper never passes `--json`. Guard-mode commands print the host's stdout shape (`kernel-cli/hooks`, Hook payloads) by default and their own decision record with `--json`, which is how tests drive them.
- **`--version`.** `bdk --version` runs `bdk version` with the arguments that follow, so `bdk --version --json` prints the `version` output object. Like `--help`, it is an implicit spelling and has no record of its own in the index.
- **`--help`.** `bdk --help`, `bdk <group> --help` and `bdk <group> <verb> --help` print usage generated from the same command index these specs are built on (`schema/cli/commands.json`): synopsis, availability, arguments, flags, exit codes. `--help` is the only usage text a skill may rely on (T02 decision R-13); a skill that repeats usage documentation fails the T15 content check. The kernel generates the usage text at run time from the index bundled into `dist/bdk.mjs`, so the text cannot drift from the record; a contract test asserts the parity for every record.
- **stdin.** Only `log ingest` (the role's report, its envelope as frontmatter), `log add --body -` (the entry body) and the `hooks` group (the host's hook payload) read stdin. Every other command ignores it.
- **Environment.** The kernel finds the plugin root from the bundle's own location (`dist/bdk.mjs` under it), not from `CLAUDE_PLUGIN_ROOT`, which the host does not export to the Bash tool. The personal configuration layer is `~/.config/bdk/settings.yaml` (XDG; the Windows equivalent is an open design item). `${CLAUDE_PLUGIN_DATA}` is used only for caches. No other environment variable changes behaviour.
- **Streams.** stdout carries the result (text, JSON or Markdown). stderr carries diagnostics and is never part of the contract; guard hooks are the exception, where stderr is the message the host shows the user on exit 2 (`kernel-cli`, Output modes).

#### Scenario: outside a git work tree

- **WHEN** any command except `version`, `ctx startup` and `hooks session-start` runs with a project root that is not inside a git work tree
- **THEN** the exit code is 5 and the error object carries `rule: runtime/not-a-repo`

#### Scenario: help parity

- **WHEN** `bdk <group> <verb> --help` runs
- **THEN** the usage text lists exactly the arguments, flags and exit codes of that command's record in `schema/cli/commands.json`

#### Scenario: Node below the minimum

- **WHEN** any command except `version` and `doctor` runs on a Node below 22.13.0 that loads the bundle (for example 22.12.0)
- **THEN** the exit code is 5, the error object carries `rule: runtime/node-version`, `why` names the running and the minimum version, and `instead` carries an install line such as `nvm install 24`

#### Scenario: help for a stubbed command

- **WHEN** `bdk <group> <verb> --help` runs for a command whose owner task has not landed
- **THEN** the exit code is 0 and the usage text is generated from the record exactly as for an implemented command

#### Scenario: repeatable flag

- **WHEN** `bdk log add finding "x" --ref a.ts --ref 02-3` runs
- **THEN** the entry's `refs` are `a.ts` and `02-3` in that order, while a second `--ticket` is `input/invalid-argument`

#### Scenario: detached HEAD

- **WHEN** a Change-scoped command runs with a detached `HEAD`
- **THEN** the exit code is 2 with `rule: policy/no-active-change` and `why` says that `HEAD` is detached

#### Scenario: bdk on the Bash tool's PATH

- **WHEN** a clean project with the plugin installed runs `bdk --version` from the Bash tool
- **THEN** the exit code is 0 and stdout is the output of `bdk version`, naming the kernel and contract versions

#### Scenario: --version with --json

- **WHEN** `bdk --version --json` runs
- **THEN** stdout is the same JSON object as `bdk version --json`, valid against `schema/cli/common/version.json`

#### Scenario: same answer through both entry points

- **WHEN** `bdk change status --json` and `node "<plugin root>/dist/bdk.mjs" change status --json` run in the same project
- **THEN** both exit with the same code and print the same object

### Requirement: Output modes

Every command SHALL run in exactly one of three output modes, fixed per command in the index (`mode`).

Three modes, fixed per command in the index (`mode`).

**Inject mode (`ctx skill|startup`, `next`, `hooks session-start`, `hooks session-end`, `hooks skill-exists`).**

Called from a skill's `!` block or from a content hook in `hooks.json`; the output is content the model reads. The kernel **always exits 0** in this mode, even on an internal failure, because the host silently drops the output of a `!` block that exits non-zero (decision Q3, live fact) and a content hook that exits non-zero shows only a notice. Errors become a STOP block rendered inside the content, exactly two lines and nothing after them:

```
BDK STOP: <why>
Instead: <instead[0]>; <instead[1]>; ...
```

`<why>` and `<instead>` are the same values the error object of `kernel-cli`, Exit codes and the error object would carry. The model treats a STOP block as an instruction to stop the skill and report the two lines.

A missing launcher (`bdk: not found`, exit 127), a missing Node or bundle (the launcher's exit 5), a Node line too old to load the bundle or a crash before the kernel's top-level handler still exits non-zero at shell level. Every `!` block therefore uses one wrapper form whose `||` branch runs in the same shell, so the block as a whole exits 0 and the STOP line is visible in the loaded skill (V1-5):

```
!`bdk ctx skill debug 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`
```

The content test (T15 `skill-check`, BDK rule plugin) accepts a `!` block only when the whole line matches this regular expression, which also restricts `!` blocks to `ctx` and `next` (Key boundaries):

```regex content-wrapper
^!`bdk (ctx skill [a-z][a-z0-9-]*|next) 2>&1 \|\| echo "BDK STOP: kernel unavailable \(exit \$\?\)\. Install Node >= 22\.13 and run /bdk:setup\."`$
```

The Node minimum `22.13` is HOST-FACTS `node-sqlite-min`. A skill with such a block SHALL carry `allowed-tools: Bash(bdk *) Bash(echo *)`: HOST-FACTS `plugin-bin-skill` confirms that this pair pre-approves the wrapper, `echo` branch and `$?` included. Without the pair the skill is lost whole in `default` permission mode (`allowed-control`). The content test checks the pair next to the wrapper. Content hooks in `hooks.json` (`hooks session-start`, `hooks session-end`) run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs"` (Invocation, Entry points) with the same `2>&1 || echo "BDK STOP: ..."` branch, without the `!` and backticks.

**Context lines of a skill.** A skill that needs prompt context carries exactly two context lines, as the first two non-empty lines of its body after the frontmatter: the content wrapper calling `ctx skill <name>` with the skill's own name, then the fallback sentence below with the same name. The fallback sentence is the portable base: running a command named in `SKILL.md` is how the Agent Skills standard and every other host work. The `!` line is the Claude Code accelerator, rendered by the host before the model reads the skill (HOST-FACTS `plugin-bin-skill`). The sentence covers the cases where the `!` line is not rendered: the host setting `disableSkillShellExecution`, which replaces the block with a placeholder, and any host that shows the line verbatim. `bdk export --host` (T23) drops the `!` line for hosts without pre-rendering and keeps the sentence. A skill carries no other `!` line that calls `ctx`. The model runs the fallback command as written, because `bdk` is on its Bash tool's `PATH`. A content test checks every skill against both regular expressions and checks that the skills with context lines are exactly the entries of the `ctx skill` manifest (`plugin-tooling`, Skill context lines):

```regex content-fallback
^If no "BDK context: ([a-z][a-z0-9-]*)" heading appears above, run `bdk ctx skill \1` first and apply its output; on a `BDK STOP` line, stop and report it\.$
```

**Command mode (everything else).**

Called from Bash by the orchestrator or a subagent, or by a test. stdout is the result, stderr is diagnostics, the exit code is the verdict (`kernel-cli`, Exit codes and the error object). A failing command prints the error object (JSON with `--json`, four labelled lines otherwise) on stdout, not stderr, so that a caller reading stdout always sees either the result or the reason.

**Guard mode (`hooks pre-tool`, `hooks prompt-expansion`).**

Called by the host through `hooks.json` with the hook payload on stdin. A guard must **fail closed**: when the kernel is missing or crashes, the tool call or the stage command must be blocked, not waved through. The `hooks.json` line therefore ends in `|| exit 2`, which the host treats as a blocking error for that one call and shows stderr to the user (hooks reference, exit code 2):

```regex guard-wrapper
node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" hooks (pre-tool|post-tool|prompt-expansion) \|\| exit 2$
```

The shell prefilter that decides whether to start Node at all (T24) precedes this fragment on the same line or in the script it calls; the regex is not anchored at the start for that reason. Within guard mode the kernel itself uses two outcomes only: **pass** is exit 0 with the host's JSON decision or plain context on stdout, **block** is exit 2 with `<rule>: <why>` on stderr followed by a line `instead: <command>; <command>` naming the refusal's `instead`, so every reason the host shows starts with its rule id and tells the user what to do next (and, for `PreToolUse`, the same text in `permissionDecisionReason` on stdout). Under `--json` a pass prints the command's decision record and a block prints the error object, as in command mode. Exit codes 3, 4 and 5 never leave a guard: an unreadable payload, a corrupted state or a missing runtime all become exit 2, because "unknown" is "blocked" (T24: an unknown payload shape means no transition). The exact stdout shapes per hook are in `kernel-cli/hooks`, Hook payloads.

#### Scenario: inject mode never fails the block

- **WHEN** an inject-mode command hits an internal failure
- **THEN** the exit code is 0 and stdout ends with a two-line STOP block (`BDK STOP: <why>` and `Instead: ...`)

#### Scenario: wrapper pre-approved

- **WHEN** a skill's `!` block uses the content wrapper and its `allowed-tools` carries the rule pair
- **THEN** the skill loads in `default` permission mode with the kernel output in place of the block

#### Scenario: guard mode fails closed

- **WHEN** a guard-mode command cannot read its payload, finds corrupted state or a missing runtime
- **THEN** the exit code is 2 with the reason on stderr, never 3, 4 or 5

#### Scenario: block reason carries the rule

- **WHEN** a guard-mode command blocks with any rule
- **THEN** its stderr is the line `<rule>: <why>` followed by the line `instead: ` and the refusal's `instead` joined by `; `, and the exit code is 2

#### Scenario: blocked stage command names the way out

- **WHEN** the user types `/bdk:plan` on a branch without an active Change
- **THEN** the prompt-expansion guard exits 2 and its stderr names `policy/no-active-change` and, on its `instead` line, `/bdk:change`

#### Scenario: guard script without a kernel

- **WHEN** a guard script of `hooks/guard/` reaches its kernel line on a machine without `node` on `PATH` or without `dist/bdk.mjs`
- **THEN** it exits 2 and stderr starts with `guard/kernel-unavailable`

#### Scenario: skill wrapper form

- **WHEN** the content check reads a `!` block in a skill
- **THEN** it accepts the block only when the whole line matches the `content-wrapper` regular expression above

#### Scenario: kernel unavailable in a skill block

- **WHEN** the content wrapper line of a skill runs in a shell where `bdk` is not on `PATH`
- **THEN** the line's output ends with `BDK STOP: kernel unavailable (exit 127). Install Node >= 22.13 and run /bdk:setup.` and the shell exits 0

#### Scenario: Node missing behind the launcher

- **WHEN** the content wrapper line of a skill runs in a shell where `bdk` is on `PATH` and `node` is not
- **THEN** the line's output holds the launcher's `bdk: kernel unavailable` line and ends with `BDK STOP: kernel unavailable (exit 5). Install Node >= 22.13 and run /bdk:setup.`, and the shell exits 0

#### Scenario: context lines of a skill

- **WHEN** the content test reads a skill whose body calls `ctx skill`
- **THEN** its first two non-empty body lines match `content-wrapper` and `content-fallback` in that order, both name the skill's own directory name, and no other line of the skill calls `ctx`

#### Scenario: shell execution disabled

- **WHEN** the host replaces the `!` line with a placeholder because `disableSkillShellExecution` is set
- **THEN** the loaded skill has no `BDK context: <name>` heading and its fallback sentence names the exact command to run
