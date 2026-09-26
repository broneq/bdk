# Spec Delta

## MODIFIED Requirements

### Requirement: Invocation

The kernel SHALL accept exactly one invocation form and resolve its project root, active Change and flags as follows.

- **Form.** `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs <group> [<verb>] <positional...> [--flag [value]]`. Groups and verbs are lowercase words. A mandatory choice that changes the command's meaning is a positional literal (`attempt close A-7f3k ok`, `config set --global` being the one flag-shaped exception because the layer is a target, not a meaning); optional inputs and switches are flags. Flags never repeat a positional. Boolean flags take no value. `--skip-verify` is not a CLI flag anywhere: it reaches the kernel only inside the `UserPromptExpansion` payload (P2).
- **Project root.** The kernel walks up from the working directory to the nearest directory containing `.bdk/`; without one, the git work tree root is the project root and `.bdk/` is created by the first writing command (`config set` from `/bdk:setup`, `import` on a v2 layout). Every command except the standalone ones requires the project root to be inside a git work tree (`runtime/not-a-repo` otherwise) and Node at or above the minimum (`runtime/node-version`). Three commands are standalone and need no work tree: `version`, so `doctor` and the wrapper's STOP line can always quote it; `ctx startup` and `hooks session-start`, because the host runs the SessionStart hook in any directory and a session outside a repository must get the STARTUP text, not a STOP line (outside a work tree `hooks session-start` prints STARTUP only, `kernel-cli/hooks`). The standalone commands still require the Node minimum, except `version`. `doctor` needs the work tree but not the Node minimum: it reports a Node below the minimum as a `fail` finding and exits 0 (`kernel-cli/service`, `bdk doctor`), because diagnosing that Node is its job. The bundle is built for the minimum line and loads `node:sqlite` only when a command opens the index, so a Node below the minimum that still loads the bundle (22.x before 22.13, 23.x before 23.4) reaches the kernel's own check and gets the refusal with the install line. Older lines (20 and below) are not supported and may fail in the module loader; the wrapper forms of Output modes turn that into a STOP line in inject mode and a block in guard mode.
- **Active Change.** Every Change-scoped command resolves the active Change from the current git branch: one active Change per branch (Key boundaries, hooks table). No command takes a `--change` flag in contract version 3; cross-Change reads use the qualified reference `<changeId>/<id>` (`kernel-cli`, Conventions). Without an active Change the command exits 2 with `policy/no-active-change` and an `instead` that names `/bdk:change new` and `bdk change resume <id>`.
- **`--json`.** Every command accepts `--json` and then prints exactly one JSON object on stdout, validated by its schema under `schema/cli/output/`. Without `--json` the same data is rendered as text. Only the JSON form is a contract; skills and tests that parse output use `--json`. Inject-mode commands (`kernel-cli`, Output modes) print Markdown by default and, with `--json`, the same content as an object (`content` plus the parts it was composed from) while still exiting 0; the `!` wrapper never passes `--json`. Guard-mode commands print the host's stdout shape (`kernel-cli/hooks`, Hook payloads) by default and their own decision record with `--json`, which is how tests drive them.
- **`--help`.** `bdk --help`, `bdk <group> --help` and `bdk <group> <verb> --help` print usage generated from the same command index these specs are built on (`schema/cli/commands.json`): synopsis, availability, arguments, flags, exit codes. `--help` is the only usage text a skill may rely on (T02 decision R-13); a skill that repeats usage documentation fails the T15 content check. The kernel generates the usage text at run time from the index bundled into `dist/bdk.mjs`, so the text cannot drift from the record; a contract test asserts the parity for every record.
- **stdin.** Only `log ingest` (the `bdk-entries` block, unless `--file` is given) and the `hooks` group (the host's hook payload) read stdin. Every other command ignores it.
- **Environment.** `CLAUDE_PLUGIN_ROOT` locates the bundle (set by the host). The personal configuration layer is `~/.config/bdk/settings.yaml` (XDG; the Windows equivalent is an open design item). `${CLAUDE_PLUGIN_DATA}` is used only for caches. No other environment variable changes behaviour.
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

A missing Node, a wrong Node version or a crash before the kernel's top-level handler still exits non-zero at shell level. Every `!` block therefore uses one wrapper form whose `||` branch runs in the same shell, so the block as a whole exits 0 and the STOP line is visible in the loaded skill (V1-5):

```
!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill debug 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`
```

The content test (T15 `skill-check`, BDK rule plugin) accepts a `!` block only when the whole line matches this regular expression, which also restricts `!` blocks to `ctx` and `next` (Key boundaries):

```regex content-wrapper
^!`node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" (ctx skill [a-z][a-z0-9-]*|next) 2>&1 \|\| echo "BDK STOP: kernel unavailable \(exit \$\?\)\. Install Node >= 22\.13 and run /bdk:setup\."`$
```

The Node minimum `22.13` is HOST-FACTS `node-sqlite-min`. A skill with such a block SHALL carry `allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)`: HOST-FACTS `wrapper` confirms that this pair pre-approves the wrapper, and `wrapper-old-rule` shows that the unquoted rule alone does not, because the host matches the quoted path literally and asks approval for the `echo` branch with its `$?`. Without the pair the skill is lost whole in `default` permission mode (`allowed-control`). The content test checks the pair next to the wrapper. Content hooks in `hooks.json` (`hooks session-start`, `hooks session-end`) use the same `2>&1 || echo "BDK STOP: ..."` branch without the `!` and backticks.

**Context lines of a skill.** A skill that needs prompt context carries exactly two context lines, as the first two non-empty lines of its body after the frontmatter: the content wrapper calling `ctx skill <name>` with the skill's own name, then the fallback sentence below with the same name. The fallback sentence is the portable base: running a command named in `SKILL.md` is how the Agent Skills standard and every other host work. The `!` line is the Claude Code accelerator, rendered by the host before the model reads the skill (HOST-FACTS `wrapper`). The sentence covers the cases where the `!` line is not rendered: the host setting `disableSkillShellExecution`, which replaces the block with a placeholder, and any host that shows the line verbatim. `bdk export --host` (T23) drops the `!` line for hosts without pre-rendering and keeps the sentence. A skill carries no other `!` line that calls `ctx`. `${CLAUDE_PLUGIN_ROOT}` resolves in skill content (plugins reference, "Where each variable resolves"), so the model runs the command with the absolute path. A content test checks every skill against both regular expressions and checks that the skills with context lines are exactly the entries of the `ctx skill` manifest (`plugin-tooling`, Skill context lines):

```regex content-fallback
^If no "BDK context: ([a-z][a-z0-9-]*)" heading appears above, run `node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" ctx skill \1` first and apply its output; on a `BDK STOP` line, stop and report it\.$
```

**Command mode (everything else).**

Called from Bash by the orchestrator or a subagent, or by a test. stdout is the result, stderr is diagnostics, the exit code is the verdict (`kernel-cli`, Exit codes and the error object). A failing command prints the error object (JSON with `--json`, four labelled lines otherwise) on stdout, not stderr, so that a caller reading stdout always sees either the result or the reason.

**Guard mode (`hooks pre-tool`, `hooks prompt-expansion`).**

Called by the host through `hooks.json` with the hook payload on stdin. A guard must **fail closed**: when the kernel is missing or crashes, the tool call or the stage command must be blocked, not waved through. The `hooks.json` line therefore ends in `|| exit 2`, which the host treats as a blocking error for that one call and shows stderr to the user (hooks reference, exit code 2):

```regex guard-wrapper
node "\$\{CLAUDE_PLUGIN_ROOT\}/dist/bdk\.mjs" hooks (pre-tool|prompt-expansion) \|\| exit 2$
```

The shell prefilter that decides whether to start Node at all (T24) precedes this fragment on the same line or in the script it calls; the regex is not anchored at the start for that reason. Within guard mode the kernel itself uses two outcomes only: **pass** is exit 0 with the host's JSON decision or plain context on stdout, **block** is exit 2 with the reason on stderr (and, for `PreToolUse`, the same reason in `permissionDecisionReason` on stdout). Exit codes 3, 4 and 5 never leave a guard: an unreadable payload, a corrupted state or a missing runtime all become exit 2, because "unknown" is "blocked" (T24: an unknown payload shape means no transition). The exact stdout shapes per hook are in `kernel-cli/hooks`, Hook payloads.

#### Scenario: inject mode never fails the block

- **WHEN** an inject-mode command hits an internal failure
- **THEN** the exit code is 0 and stdout ends with a two-line STOP block (`BDK STOP: <why>` and `Instead: ...`)

#### Scenario: wrapper pre-approved

- **WHEN** a skill's `!` block uses the content wrapper and its `allowed-tools` carries the rule pair
- **THEN** the skill loads in `default` permission mode with the kernel output in place of the block

#### Scenario: guard mode fails closed

- **WHEN** a guard-mode command cannot read its payload, finds corrupted state or a missing runtime
- **THEN** the exit code is 2 with the reason on stderr, never 3, 4 or 5

#### Scenario: skill wrapper form

- **WHEN** the content check reads a `!` block in a skill
- **THEN** it accepts the block only when the whole line matches the `content-wrapper` regular expression above

#### Scenario: kernel unavailable in a skill block

- **WHEN** the content wrapper line of a skill runs in a shell where `node` is not on `PATH`
- **THEN** the line's output ends with `BDK STOP: kernel unavailable (exit 127). Install Node >= 22.13 and run /bdk:setup.` and the shell exits 0

#### Scenario: context lines of a skill

- **WHEN** the content test reads a skill whose body calls `ctx skill`
- **THEN** its first two non-empty body lines match `content-wrapper` and `content-fallback` in that order, both name the skill's own directory name, and no other line of the skill calls `ctx`

#### Scenario: shell execution disabled

- **WHEN** the host replaces the `!` line with a placeholder because `disableSkillShellExecution` is set
- **THEN** the loaded skill has no `BDK context: <name>` heading and its fallback sentence names the exact command to run

### Requirement: Exit codes and the error object

Every non-zero exit except 1 SHALL emit one four-field error object; the class prefix of `rule` SHALL determine the exit code.

| Exit | Meaning         | Rule classes                   | Notes                                                                                                                                                     |
| ---- | --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | ok              | -                              | Result on stdout. Inject mode always exits 0, even for a STOP block.                                                                                      |
| 1    | uncaught crash  | -                              | A kernel bug by definition. Stack trace on stderr, no object on stdout. Never emitted on purpose; a contract test that sees exit 1 fails the build.       |
| 2    | refusal         | `policy/`, `guard/`, `kernel/` | The command understood the input and declined: a policy of the Change process, a guard, or a stub for a command whose owner task has not landed.          |
| 3    | input error     | `input/`                       | Unknown command or flag, missing or malformed argument, a kernel-stamped field passed as input, a block that fails validation, an id that does not exist. |
| 4    | corrupted state | `state/`                       | The committed Change files or the index are inconsistent. `instead` always names `bdk rebuild`.                                                           |
| 5    | missing runtime | `runtime/`                     | Node below the minimum, no git, not inside a work tree. `instead` carries the exact install or setup command.                                             |

Every non-zero exit except 1 emits one **error object** with exactly four fields (`schema/cli/common/refusal.json`):

```json refusal
{
  "refused": true,
  "rule": "policy/budget-exhausted",
  "why": "loop task-redispatch for 02-3 used 3 of 3 attempts; the last two failed with the same fingerprint",
  "instead": [
    "bdk attempt open task-escalation 02-3",
    "bdk change park --reason \"02-3 exhausted\""
  ]
}
```

`refused` is always `true`. `rule` is a stable identifier from the catalogue below; the class before the slash determines the exit code. `why` is one sentence carrying the concrete values (ids, counts, paths), never a generic phrase. `instead` lists at least one concrete command or action the caller can take next. Without `--json` the same object prints as four labelled lines:

```
refused: policy/budget-exhausted
why: loop task-redispatch for 02-3 used 3 of 3 attempts; the last two failed with the same fingerprint
instead: bdk attempt open task-escalation 02-3
instead: bdk change park --reason "02-3 exhausted"
```

There is no second error shape. Input errors, corrupted state and missing runtime use the same four fields; only the class and the exit code differ. The model-facing rule is one sentence: _a non-zero exit prints `refused` with a `rule`; do the first `instead` or report the `why`, never retry the same command unchanged._

**Rule catalogue.** Commands declare in the index which rules they may emit (`refusals`); the coverage test checks that every declared rule is in the table below.

| Rule                            | Exit | Emitted by                                                                                                                                      | Meaning                                                                                                                                                         |
| ------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input/unknown-command`         | 3    | every command                                                                                                                                   | The group or verb does not exist; `instead` names `bdk --help` and the closest match.                                                                           |
| `input/unknown-flag`            | 3    | every command                                                                                                                                   | A flag the command does not declare.                                                                                                                            |
| `input/missing-argument`        | 3    | every command                                                                                                                                   | A required positional or flag value is absent, or stdin is empty where a block was expected.                                                                    |
| `input/invalid-argument`        | 3    | every command                                                                                                                                   | A value has the wrong form: an unknown outcome literal, a malformed id, a non-existent layer, a path outside the project.                                       |
| `input/forbidden-field`         | 3    | `log add`, `log ingest`                                                                                                                         | A kernel-stamped field (`id`, `at`, `author`, `source`) was passed as input (P1).                                                                               |
| `input/invalid-block`           | 3    | `log ingest`                                                                                                                                    | The `bdk-entries` block does not parse or one entry fails validation; `why` names the line and the field, and the whole block is rejected (T2).                 |
| `input/not-found`               | 3    | commands taking an id, path, key, skill, role or artifact (each entry declares it)                                                              | The referenced object does not exist in the active Change, the configuration or the bundle.                                                                     |
| `policy/no-active-change`       | 2    | every Change-scoped command                                                                                                                     | No Change is bound to the current branch.                                                                                                                       |
| `policy/change-exists`          | 2    | `change new`, `change resume`                                                                                                                   | The branch already has an active Change; `instead` names `change status` and `change close`.                                                                    |
| `policy/gate-not-ready`         | 2    | `change close`, `done`, `spec merge`, `hooks prompt-expansion`                                                                                  | The gate node is not ready: `why` names what is missing (T1).                                                                                                   |
| `policy/not-ready`              | 2    | `done`, `part start`, `attempt open`                                                                                                            | The artifact, part or task is blocked by an unfinished `requires` edge; `instead` names `bdk explain <artifact>`.                                               |
| `policy/validation-failed`      | 2    | `validate`, `done`, `part done`                                                                                                                 | A kind validator failed; `why` carries the first failing check.                                                                                                 |
| `policy/part-too-large`         | 2    | `validate`, `part start`                                                                                                                        | A plan part is over 8 KB (S1, P6).                                                                                                                              |
| `policy/part-too-many-tasks`    | 2    | `validate`, `part start`                                                                                                                        | A plan part has more than 8 tasks (S1).                                                                                                                         |
| `policy/do-not-touch-overlap`   | 2    | `validate`, `part start`                                                                                                                        | A task's `Files:` intersects the part's `do-not-touch` (P6).                                                                                                    |
| `policy/placeholder`            | 2    | `validate`, `part start`, `dispatch build`                                                                                                      | An executable field contains `TODO`, `<fill in>` or `...` (P6, P7).                                                                                             |
| `policy/budget-exhausted`       | 2    | `attempt open`                                                                                                                                  | The loop's budget is used up; `instead` names the next rung of the ladder (A-drabina).                                                                          |
| `policy/oscillation`            | 2    | `attempt open`                                                                                                                                  | The same finding fingerprint returned twice after a fix; the ladder is shortened.                                                                               |
| `policy/no-open-ticket`         | 2    | `attempt close`, `log add`, `log ingest`, `dispatch build`, `dispatch run`, `evidence record`                                                   | No open ticket for the task, or the ticket named does not match.                                                                                                |
| `policy/ticket-open`            | 2    | `change park`, `change takeover`, `change checkpoint`, `change close`, `part done`, `part split`, `attempt open`, `commit`, `hooks session-end` | A ticket is still open; subagents may still be writing.                                                                                                         |
| `policy/package-too-large`      | 2    | `dispatch build`                                                                                                                                | The package exceeds 12 KB (K4).                                                                                                                                 |
| `policy/do-not-touch`           | 2    | `attempt close`, `commit`                                                                                                                       | The real diff touches a `do-not-touch` path (P6).                                                                                                               |
| `policy/entries-missing`        | 2    | `attempt close`                                                                                                                                 | The envelope declares ledger ids that do not exist under this ticket.                                                                                           |
| `policy/stale-evidence`         | 2    | `attempt close`, `evidence check`                                                                                                               | The evidence manifest is older than the last code change (P5).                                                                                                  |
| `policy/missing-citation`       | 2    | `done`, `attempt close`, `evidence record`                                                                                                      | A PASS verdict cites no value that resolves inside the recorded evidence (T4).                                                                                  |
| `policy/observation-cap`        | 2    | `log add`, `log ingest`                                                                                                                         | The per-dispatch cap on `observation` entries is reached (K2).                                                                                                  |
| `policy/invalid-transition`     | 2    | `change resume`, `change park`, `change takeover`, `part start`, `part done`, `part split`, `log resolve`, `dispatch run`                       | The Change or part is not in a state from which the verb applies; `why` names the current state.                                                                |
| `policy/git-in-progress`        | 2    | `change checkpoint`, `commit`, `hooks session-end`                                                                                              | A rebase, merge or cherry-pick is in progress (V1-4).                                                                                                           |
| `policy/nothing-to-commit`      | 2    | `commit`                                                                                                                                        | Neither the code nor the Change directory changed since the last commit for this task.                                                                          |
| `policy/spec-invalid`           | 2    | `validate`, `spec delta check`, `spec merge`                                                                                                    | A delta breaks the format: `Scenario:` prefix, missing WHEN / THEN, a scenario lost without `REMOVED` (D2b).                                                    |
| `policy/spec-conflict`          | 2    | `change close`, `spec merge`                                                                                                                    | Two deltas edit the same requirement differently; `why` names both.                                                                                             |
| `policy/merge-hash-mismatch`    | 2    | `change close`, `spec merge`, `doctor`                                                                                                          | A spec file's content hash differs from its `bdk-merge-hash` (V1-7).                                                                                            |
| `policy/unknown-config-key`     | 2    | `config show`, `config check`, `config set`, `ctx skill`                                                                                        | A key no module schema declares; `why` lists the keys.                                                                                                          |
| `policy/config-invalid`         | 2    | `config show`, `config check`, `config set`, `ctx skill`, `import`                                                                              | A value fails its module schema.                                                                                                                                |
| `policy/profile-downgrade`      | 2    | `change new`, `change resume`                                                                                                                   | The requested profile is smaller than the current one (R-profil).                                                                                               |
| `policy/rule-format`            | 2    | `rules check`, `rules add`, `rules import`, `rules export`                                                                                      | A rule lacks its `[PREFIX-n]`, or a `knowledge` rule with a fact lacks `source` / `verified` (T5).                                                              |
| `policy/duplicate-rule-id`      | 2    | `rules check`, `rules import`, `import`                                                                                                         | Two rules carry the same id, typically after a parallel close (V1-6).                                                                                           |
| `guard/subagent-git`            | 2    | `hooks pre-tool`                                                                                                                                | A subagent ran a destructive or history-writing git command (T3).                                                                                               |
| `guard/subagent-kernel-command` | 2    | `hooks pre-tool`                                                                                                                                | A subagent invoked an `orchestrator` or `hook` class command (`kernel-cli`, Availability classes).                                                              |
| `guard/hooks-from-bash`         | 2    | `hooks pre-tool`                                                                                                                                | Any thread invoked `bdk.mjs hooks` through Bash (T1 defence in depth).                                                                                          |
| `guard/spec-dir-write`          | 2    | `hooks pre-tool`                                                                                                                                | A tool call writes under `.bdk/specs/` (V1-7).                                                                                                                  |
| `guard/kernel-unavailable`      | 2    | the `\|\| exit 2` branch                                                                                                                        | Not emitted by the kernel: the shell fragment produces it when Node or the bundle is missing. Listed so that the catalogue names every reason a caller can see. |
| `state/corrupted-index`         | 4    | every Change-scoped command                                                                                                                     | The SQLite index cannot be opened or disagrees with the files after a lazy rebuild.                                                                             |
| `state/ledger-invalid`          | 4    | every Change-scoped command                                                                                                                     | A committed entry, attempt or manifest fails its schema (T14).                                                                                                  |
| `state/trailer-mismatch`        | 4    | `change close`, `part done`, `rebuild`                                                                                                          | Progress derived from git trailers disagrees with the committed attempt records.                                                                                |
| `state/change-dir-missing`      | 4    | every Change-scoped command                                                                                                                     | The branch marker names a Change whose directory is gone.                                                                                                       |
| `runtime/node-version`          | 5    | every command except `version` and `doctor`                                                                                                     | Node is below 22.13.0 (HOST-FACTS `node-sqlite-min`); `instead` carries the install line.                                                                       |
| `runtime/not-a-repo`            | 5    | every command except `version`                                                                                                                  | The project root is not inside a git work tree.                                                                                                                 |
| `runtime/git-missing`           | 5    | every command that shells out to git                                                                                                            | No `git` executable on `PATH`.                                                                                                                                  |
| `kernel/not-implemented`        | 2    | any stubbed command                                                                                                                             | The command exists in the index but its owner task has not landed; `instead` names the task.                                                                    |

#### Scenario: refusal in JSON

- **WHEN** a command refuses under `--json`
- **THEN** stdout is one object with exactly `refused`, `rule`, `why` and `instead`, and the exit code is 2, 3, 4 or 5 by the class of `rule`

#### Scenario: refusal in text mode

- **WHEN** a command refuses without `--json`
- **THEN** stdout is the four labelled lines (`refused:`, `why:`, one `instead:` per action) and nothing else

#### Scenario: undeclared rule

- **WHEN** a command record declares a rule in `refusals` that the catalogue does not list
- **THEN** the contract test fails

### Requirement: Availability classes

Each command SHALL carry exactly one availability class in the index, and the `hooks pre-tool` guard SHALL enforce the classes by exact verb.

Each command carries exactly one class in the index (`availability`). The `hooks pre-tool` guard (T24) reads the same index: it denies a subagent (hook input carries `agent_id`) every command whose verb is `orchestrator` or `hook`, and denies every thread a Bash invocation of a `hook` command. The match is by exact verb from the index, not by group prefix, so a read-only verb inside a guarded group (`change status`, `attempt list`, `part list`) stays callable from a subagent; the design's group-level deny list ("`bdk.mjs commit|attempt|part|change|log ingest|spec merge|hooks`") is the same set at verb granularity. The deny reason names the verb and tells the agent to return `blocked` with the cause instead of working around it.

| Class          | Who may call                                              | Guarded                                                                 | Verbs                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orchestrator` | The main thread (the orchestrating skill) and tests.      | Yes: denied to subagents by `hooks pre-tool`.                           | Every command that writes into the Change, the working tree or the configuration: `change new\|resume\|park\|takeover\|checkpoint\|close`, `done`, `part start\|done\|split`, `attempt open\|close`, `log ingest\|resolve\|route`, `dispatch build\|run`, `spec merge`, `config set`, `commit`, `rules add\|import\|export`, `export agents`, `rebuild`, `import`. |
| `agent`        | Subagents and the main thread.                            | No.                                                                     | The five operations a worker or runner needs (T2, T3): `log add`, `log show`, `dispatch show`, `evidence record`, `ctx skill\|startup`.                                                                                                                                                                                                                            |
| `hook`         | The host only, through `hooks.json` or skill frontmatter. | Yes: a Bash invocation is denied in every thread (T1 defence in depth). | `hooks session-start\|session-end\|prompt-expansion\|pre-tool\|skill-exists`.                                                                                                                                                                                                                                                                                      |
| `read`         | Anyone.                                                   | No.                                                                     | Read-only queries with no side effect beyond the lazy index rebuild: `next`, `explain`, `validate`, `measure`, `change status\|list`, `part list`, `attempt list`, `log list`, `evidence check`, `spec delta check\|diff`, `config show\|check\|schema`, `query`, `rules check\|show\|explain\|prune\|stats`, `doctor`, `version`.                                 |

`hooks prompt-expansion` is the only writer of `source: user` transition entries; there is no `approve`, no `gate pass`, and `log add` cannot produce `source: user` (T1, P1, S8). A model that wants a gate passed has exactly one option: render the gate status and stop, so that the user types the next stage command.

**Cross-check with the state contract (T14).** Every command that writes lists the Change directory paths it may touch in `writes[]` (index field); `read` commands have an empty list. T14's write map names a writer for every file in the Change directory and checks that each writer is an `orchestrator`, `agent` or `hook` command here, never a `read` one.

#### Scenario: subagent calls an orchestrator verb

- **WHEN** a `PreToolUse` payload with `agent_id` carries a Bash command invoking an `orchestrator` verb such as `bdk.mjs commit`
- **THEN** `hooks pre-tool` denies with `guard/subagent-kernel-command` and the reason names the verb

#### Scenario: subagent calls a read verb of a guarded group

- **WHEN** a subagent invokes `bdk.mjs attempt list`
- **THEN** `hooks pre-tool` passes, because the match is by verb, not by group

#### Scenario: hook verb from Bash

- **WHEN** any thread invokes `bdk.mjs hooks ...` through Bash
- **THEN** `hooks pre-tool` denies with `guard/hooks-from-bash`
