# Spec Delta

## MODIFIED Requirements

### Requirement: Invocation

The kernel SHALL accept exactly one invocation form and resolve its project root, active Change and flags as follows.

- **Form.** `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs <group> [<verb>] <positional...> [--flag [value]]`. Groups and verbs are lowercase words. A mandatory choice that changes the command's meaning is a positional literal (`attempt close A-7f3k ok`, `config set --global` being the one flag-shaped exception because the layer is a target, not a meaning); optional inputs and switches are flags. Flags never repeat a positional. Boolean flags take no value. `--skip-verify` is not a CLI flag anywhere: it reaches the kernel only inside the `UserPromptExpansion` payload (P2).
- **Project root.** The kernel walks up from the working directory to the nearest directory containing `.bdk/`; without one, the git work tree root is the project root and `.bdk/` is created by the first writing command (`config set` from `/bdk:setup`, `import` on a v2 layout). Every command except `version` requires the project root to be inside a git work tree (`runtime/not-a-repo` otherwise) and Node at or above the minimum (`runtime/node-version`); `version` is the one standalone command, so `doctor` and the wrapper's STOP line can always quote it. `doctor` needs the work tree but not the Node minimum: it reports a Node below the minimum as a `fail` finding and exits 0 (`kernel-cli/service`, `bdk doctor`), because diagnosing that Node is its job. The bundle is built for the minimum line and loads `node:sqlite` only when a command opens the index, so a Node below the minimum that still loads the bundle (22.x before 22.13, 23.x before 23.4) reaches the kernel's own check and gets the refusal with the install line. Older lines (20 and below) are not supported and may fail in the module loader; the wrapper forms of Output modes turn that into a STOP line in inject mode and a block in guard mode.
- **Active Change.** Every Change-scoped command resolves the active Change from the current git branch: one active Change per branch (Key boundaries, hooks table). No command takes a `--change` flag in contract version 3; cross-Change reads use the qualified reference `<changeId>/<id>` (`kernel-cli`, Conventions). Without an active Change the command exits 2 with `policy/no-active-change` and an `instead` that names `/bdk:change new` and `bdk change resume <id>`.
- **`--json`.** Every command accepts `--json` and then prints exactly one JSON object on stdout, validated by its schema under `schema/cli/output/`. Without `--json` the same data is rendered as text. Only the JSON form is a contract; skills and tests that parse output use `--json`. Inject-mode commands (`kernel-cli`, Output modes) print Markdown by default and, with `--json`, the same content as an object (`content` plus the parts it was composed from) while still exiting 0; the `!` wrapper never passes `--json`. Guard-mode commands print the host's stdout shape (`kernel-cli/hooks`, Hook payloads) by default and their own decision record with `--json`, which is how tests drive them.
- **`--help`.** `bdk --help`, `bdk <group> --help` and `bdk <group> <verb> --help` print usage generated from the same command index these specs are built on (`schema/cli/commands.json`): synopsis, availability, arguments, flags, exit codes. `--help` is the only usage text a skill may rely on (T02 decision R-13); a skill that repeats usage documentation fails the T15 content check. The kernel generates the usage text at run time from the index bundled into `dist/bdk.mjs`, so the text cannot drift from the record; a contract test asserts the parity for every record.
- **stdin.** Only `log ingest` (the `bdk-entries` block, unless `--file` is given) and the `hooks` group (the host's hook payload) read stdin. Every other command ignores it.
- **Environment.** `CLAUDE_PLUGIN_ROOT` locates the bundle (set by the host). The personal configuration layer is `~/.config/bdk/settings.yaml` (XDG; the Windows equivalent is an open design item). `${CLAUDE_PLUGIN_DATA}` is used only for caches. No other environment variable changes behaviour.
- **Streams.** stdout carries the result (text, JSON or Markdown). stderr carries diagnostics and is never part of the contract; guard hooks are the exception, where stderr is the message the host shows the user on exit 2 (`kernel-cli`, Output modes).

#### Scenario: outside a git work tree

- **WHEN** any command except `version` runs with a project root that is not inside a git work tree
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

### Requirement: Exit codes and the error object

Every non-zero exit except 1 SHALL emit one four-field error object; the class prefix of `rule` SHALL determine the exit code.

| Exit | Meaning | Rule classes | Notes |
|---|---|---|---|
| 0 | ok | - | Result on stdout. Inject mode always exits 0, even for a STOP block. |
| 1 | uncaught crash | - | A kernel bug by definition. Stack trace on stderr, no object on stdout. Never emitted on purpose; a contract test that sees exit 1 fails the build. |
| 2 | refusal | `policy/`, `guard/`, `kernel/` | The command understood the input and declined: a policy of the Change process, a guard, or a stub for a command whose owner task has not landed. |
| 3 | input error | `input/` | Unknown command or flag, missing or malformed argument, a kernel-stamped field passed as input, a block that fails validation, an id that does not exist. |
| 4 | corrupted state | `state/` | The committed Change files or the index are inconsistent. `instead` always names `bdk rebuild`. |
| 5 | missing runtime | `runtime/` | Node below the minimum, no git, not inside a work tree. `instead` carries the exact install or setup command. |

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

There is no second error shape. Input errors, corrupted state and missing runtime use the same four fields; only the class and the exit code differ. The model-facing rule is one sentence: *a non-zero exit prints `refused` with a `rule`; do the first `instead` or report the `why`, never retry the same command unchanged.*

**Rule catalogue.** Commands declare in the index which rules they may emit (`refusals`); the coverage test checks that every declared rule is in the table below.

| Rule | Exit | Emitted by | Meaning |
|---|---|---|---|
| `input/unknown-command` | 3 | every command | The group or verb does not exist; `instead` names `bdk --help` and the closest match. |
| `input/unknown-flag` | 3 | every command | A flag the command does not declare. |
| `input/missing-argument` | 3 | every command | A required positional or flag value is absent, or stdin is empty where a block was expected. |
| `input/invalid-argument` | 3 | every command | A value has the wrong form: an unknown outcome literal, a malformed id, a non-existent layer, a path outside the project. |
| `input/forbidden-field` | 3 | `log add`, `log ingest` | A kernel-stamped field (`id`, `at`, `author`, `source`) was passed as input (P1). |
| `input/invalid-block` | 3 | `log ingest` | The `bdk-entries` block does not parse or one entry fails validation; `why` names the line and the field, and the whole block is rejected (T2). |
| `input/not-found` | 3 | commands taking an id, path, key, skill, role or artifact (each entry declares it) | The referenced object does not exist in the active Change, the configuration or the bundle. |
| `policy/no-active-change` | 2 | every Change-scoped command | No Change is bound to the current branch. |
| `policy/change-exists` | 2 | `change new`, `change resume` | The branch already has an active Change; `instead` names `change status` and `change close`. |
| `policy/gate-not-ready` | 2 | `change close`, `done`, `spec merge`, `hooks prompt-expansion` | The gate node is not ready: `why` names what is missing (T1). |
| `policy/not-ready` | 2 | `done`, `part start`, `attempt open` | The artifact, part or task is blocked by an unfinished `requires` edge; `instead` names `bdk explain <artifact>`. |
| `policy/validation-failed` | 2 | `validate`, `done`, `part done` | A kind validator failed; `why` carries the first failing check. |
| `policy/part-too-large` | 2 | `validate`, `part start` | A plan part is over 8 KB (S1, P6). |
| `policy/part-too-many-tasks` | 2 | `validate`, `part start` | A plan part has more than 8 tasks (S1). |
| `policy/do-not-touch-overlap` | 2 | `validate`, `part start` | A task's `Files:` intersects the part's `do-not-touch` (P6). |
| `policy/placeholder` | 2 | `validate`, `part start`, `dispatch build` | An executable field contains `TODO`, `<fill in>` or `...` (P6, P7). |
| `policy/budget-exhausted` | 2 | `attempt open` | The loop's budget is used up; `instead` names the next rung of the ladder (A-drabina). |
| `policy/oscillation` | 2 | `attempt open` | The same finding fingerprint returned twice after a fix; the ladder is shortened. |
| `policy/no-open-ticket` | 2 | `attempt close`, `log add`, `log ingest`, `dispatch build`, `dispatch run`, `evidence record` | No open ticket for the task, or the ticket named does not match. |
| `policy/ticket-open` | 2 | `change park`, `change takeover`, `change checkpoint`, `change close`, `part done`, `part split`, `attempt open`, `commit`, `hooks session-end` | A ticket is still open; subagents may still be writing. |
| `policy/package-too-large` | 2 | `dispatch build` | The package exceeds 12 KB (K4). |
| `policy/do-not-touch` | 2 | `attempt close`, `commit` | The real diff touches a `do-not-touch` path (P6). |
| `policy/entries-missing` | 2 | `attempt close` | The envelope declares ledger ids that do not exist under this ticket. |
| `policy/stale-evidence` | 2 | `attempt close`, `evidence check` | The evidence manifest is older than the last code change (P5). |
| `policy/missing-citation` | 2 | `done`, `attempt close`, `evidence record` | A PASS verdict cites no value that resolves inside the recorded evidence (T4). |
| `policy/observation-cap` | 2 | `log add`, `log ingest` | The per-dispatch cap on `observation` entries is reached (K2). |
| `policy/invalid-transition` | 2 | `change resume`, `change park`, `change takeover`, `part start`, `part done`, `part split`, `log resolve`, `dispatch run` | The Change or part is not in a state from which the verb applies; `why` names the current state. |
| `policy/git-in-progress` | 2 | `change checkpoint`, `commit`, `hooks session-end` | A rebase, merge or cherry-pick is in progress (V1-4). |
| `policy/nothing-to-commit` | 2 | `commit` | Neither the code nor the Change directory changed since the last commit for this task. |
| `policy/spec-invalid` | 2 | `validate`, `spec delta check`, `spec merge` | A delta breaks the format: `Scenario:` prefix, missing WHEN / THEN, a scenario lost without `REMOVED` (D2b). |
| `policy/spec-conflict` | 2 | `change close`, `spec merge` | Two deltas edit the same requirement differently; `why` names both. |
| `policy/merge-hash-mismatch` | 2 | `change close`, `spec merge`, `doctor` | A spec file's content hash differs from its `bdk-merge-hash` (V1-7). |
| `policy/unknown-config-key` | 2 | `config show`, `config check`, `config set`, `ctx skill`, `ctx role`, `ctx startup`, `hooks session-start` | A key no module schema declares; `why` lists the keys. |
| `policy/config-invalid` | 2 | `config show`, `config check`, `config set`, `hooks session-start`, `import` | A value fails its module schema. |
| `policy/profile-downgrade` | 2 | `change new`, `change resume` | The requested profile is smaller than the current one (R-profil). |
| `policy/rule-format` | 2 | `rules check`, `rules add`, `rules import`, `rules export` | A rule lacks its `[PREFIX-n]`, or a `knowledge` rule with a fact lacks `source` / `verified` (T5). |
| `policy/duplicate-rule-id` | 2 | `rules check`, `rules import`, `import` | Two rules carry the same id, typically after a parallel close (V1-6). |
| `guard/subagent-git` | 2 | `hooks pre-tool` | A subagent ran a destructive or history-writing git command (T3). |
| `guard/subagent-kernel-command` | 2 | `hooks pre-tool` | A subagent invoked an `orchestrator` or `hook` class command (`kernel-cli`, Availability classes). |
| `guard/hooks-from-bash` | 2 | `hooks pre-tool` | Any thread invoked `bdk.mjs hooks` through Bash (T1 defence in depth). |
| `guard/spec-dir-write` | 2 | `hooks pre-tool` | A tool call writes under `.bdk/specs/` (V1-7). |
| `guard/kernel-unavailable` | 2 | the `\|\| exit 2` branch | Not emitted by the kernel: the shell fragment produces it when Node or the bundle is missing. Listed so that the catalogue names every reason a caller can see. |
| `state/corrupted-index` | 4 | every Change-scoped command | The SQLite index cannot be opened or disagrees with the files after a lazy rebuild. |
| `state/ledger-invalid` | 4 | every Change-scoped command | A committed entry, attempt or manifest fails its schema (T14). |
| `state/trailer-mismatch` | 4 | `change close`, `part done`, `rebuild` | Progress derived from git trailers disagrees with the committed attempt records. |
| `state/change-dir-missing` | 4 | every Change-scoped command | The branch marker names a Change whose directory is gone. |
| `runtime/node-version` | 5 | every command except `version` and `doctor` | Node is below 22.13.0 (HOST-FACTS `node-sqlite-min`); `instead` carries the install line. |
| `runtime/not-a-repo` | 5 | every command except `version` | The project root is not inside a git work tree. |
| `runtime/git-missing` | 5 | every command that shells out to git | No `git` executable on `PATH`. |
| `kernel/not-implemented` | 2 | any stubbed command | The command exists in the index but its owner task has not landed; `instead` names the task. |

#### Scenario: refusal in JSON

- **WHEN** a command refuses under `--json`
- **THEN** stdout is one object with exactly `refused`, `rule`, `why` and `instead`, and the exit code is 2, 3, 4 or 5 by the class of `rule`

#### Scenario: refusal in text mode

- **WHEN** a command refuses without `--json`
- **THEN** stdout is the four labelled lines (`refused:`, `why:`, one `instead:` per action) and nothing else

#### Scenario: undeclared rule

- **WHEN** a command record declares a rule in `refusals` that the catalogue does not list
- **THEN** the contract test fails
