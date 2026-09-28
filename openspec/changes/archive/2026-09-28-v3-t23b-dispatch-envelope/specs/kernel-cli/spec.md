## MODIFIED Requirements

### Requirement: Invocation

The kernel SHALL accept exactly one invocation form and resolve its project root, active Change and flags as follows.

- **Form.** `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs <group> [<verb>] <positional...> [--flag [value]]`. Groups and verbs are lowercase words. A mandatory choice that changes the command's meaning is a positional literal (`attempt close A-7f3k ok`, `config set --global` being the one flag-shaped exception because the layer is a target, not a meaning); optional inputs and switches are flags. Flags never repeat a positional. Boolean flags take no value. A flag is given at most once unless its index record marks it `repeatable` (`log add --ref`, `change park --option`); a repeatable flag collects its values in order, and `--help` shows it as repeatable. `--skip-verify` is not a CLI flag anywhere: it reaches the kernel only inside the `UserPromptExpansion` payload (P2).
- **Project root.** The kernel walks up from the working directory to the nearest directory containing `.bdk/`; without one, the git work tree root is the project root and `.bdk/` is created by the first writing command (`config set` from `/bdk:setup`, `import` on a v2 layout). Every command except the standalone ones requires the project root to be inside a git work tree (`runtime/not-a-repo` otherwise) and Node at or above the minimum (`runtime/node-version`). Three commands are standalone and need no work tree: `version`, so `doctor` and the wrapper's STOP line can always quote it; `ctx startup` and `hooks session-start`, because the host runs the SessionStart hook in any directory and a session outside a repository must get the STARTUP text, not a STOP line (outside a work tree `hooks session-start` prints STARTUP only, `kernel-cli/hooks`). The standalone commands still require the Node minimum, except `version`. `doctor` needs the work tree but not the Node minimum: it reports a Node below the minimum as a `fail` finding and exits 0 (`kernel-cli/service`, `bdk doctor`), because diagnosing that Node is its job. The bundle is built for the minimum line and loads `node:sqlite` only when a command opens the index, so a Node below the minimum that still loads the bundle (22.x before 22.13, 23.x before 23.4) reaches the kernel's own check and gets the refusal with the install line. Older lines (20 and below) are not supported and may fail in the module loader; the wrapper forms of Output modes turn that into a STOP line in inject mode and a block in guard mode.
- **Active Change.** Every Change-scoped command resolves the active Change from the current git branch: one active Change per branch (Key boundaries, hooks table). No command takes a `--change` flag in contract version 3; cross-Change reads use the qualified reference `<changeId>/<id>` (`kernel-cli`, Conventions). The binding is a local marker per branch (`kernel-state`, Branch binding); the current branch is read from `HEAD`, and a detached `HEAD` has no active Change. Without an active Change the command exits 2 with `policy/no-active-change` and an `instead` that names `/bdk:change new` and `bdk change resume <id>` (with the ids of the unarchived Changes when there are any); a marker naming a Change whose directory is gone is `state/change-dir-missing`.
- **`--json`.** Every command accepts `--json` and then prints exactly one JSON object on stdout, validated by its schema under `schema/cli/output/`. Without `--json` the same data is rendered as text. Only the JSON form is a contract; skills and tests that parse output use `--json`. Inject-mode commands (`kernel-cli`, Output modes) print Markdown by default and, with `--json`, the same content as an object (`content` plus the parts it was composed from) while still exiting 0; the `!` wrapper never passes `--json`. Guard-mode commands print the host's stdout shape (`kernel-cli/hooks`, Hook payloads) by default and their own decision record with `--json`, which is how tests drive them.
- **`--help`.** `bdk --help`, `bdk <group> --help` and `bdk <group> <verb> --help` print usage generated from the same command index these specs are built on (`schema/cli/commands.json`): synopsis, availability, arguments, flags, exit codes. `--help` is the only usage text a skill may rely on (T02 decision R-13); a skill that repeats usage documentation fails the T15 content check. The kernel generates the usage text at run time from the index bundled into `dist/bdk.mjs`, so the text cannot drift from the record; a contract test asserts the parity for every record.
- **stdin.** Only `log ingest` (the role's report, its envelope as frontmatter), `log add --body -` (the entry body) and the `hooks` group (the host's hook payload) read stdin. Every other command ignores it.
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

#### Scenario: repeatable flag

- **WHEN** `bdk log add finding "x" --ref a.ts --ref 02-3` runs
- **THEN** the entry's `refs` are `a.ts` and `02-3` in that order, while a second `--ticket` is `input/invalid-argument`

#### Scenario: detached HEAD

- **WHEN** a Change-scoped command runs with a detached `HEAD`
- **THEN** the exit code is 2 with `rule: policy/no-active-change` and `why` says that `HEAD` is detached

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

| Rule                            | Exit | Emitted by                                                                                                                                      | Meaning                                                                                                                                                                                                |
| ------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `input/unknown-command`         | 3    | every command                                                                                                                                   | The group or verb does not exist; `instead` names `bdk --help` and the closest match.                                                                                                                  |
| `input/unknown-flag`            | 3    | every command                                                                                                                                   | A flag the command does not declare.                                                                                                                                                                   |
| `input/missing-argument`        | 3    | every command                                                                                                                                   | A required positional or flag value is absent, or stdin is empty where a report or a body was expected.                                                                                                |
| `input/invalid-argument`        | 3    | every command                                                                                                                                   | A value has the wrong form: an unknown outcome literal, a malformed id, a non-existent layer, a path outside the project.                                                                              |
| `input/forbidden-field`         | 3    | `log add`, `log ingest`                                                                                                                         | A kernel-stamped field (`id`, `at`, `author`, `source`, `fingerprint`; `schema`, `ticket` and `role` of a report envelope) was passed as input (P1), including as a flag the command does not declare. |
| `input/invalid-envelope`        | 3    | `log ingest`                                                                                                                                    | The report's envelope frontmatter is missing, carries an unknown field or fails the envelope schema; `why` names the field and its line, and nothing is stored.                                        |
| `input/not-found`               | 3    | commands taking an id, path, key, skill, role or artifact (each entry declares it)                                                              | The referenced object does not exist in the active Change, the configuration or the bundle.                                                                                                            |
| `policy/no-active-change`       | 2    | every Change-scoped command                                                                                                                     | No Change is bound to the current branch.                                                                                                                                                              |
| `policy/change-exists`          | 2    | `change new`, `change resume`                                                                                                                   | The branch already has an active Change; `instead` names `change status` and `change close`.                                                                                                           |
| `policy/gate-not-ready`         | 2    | `change close`, `done`, `spec merge`, `hooks prompt-expansion`                                                                                  | The gate node is not ready: `why` names what is missing (T1).                                                                                                                                          |
| `policy/not-ready`              | 2    | `done`, `part start`, `attempt open`                                                                                                            | The artifact, part or task is blocked by an unfinished `requires` edge; `instead` names `bdk explain <artifact>`.                                                                                      |
| `policy/validation-failed`      | 2    | `validate`, `done`, `part done`, `part start`                                                                                                   | A kind validator failed; `why` carries the first failing check.                                                                                                                                        |
| `policy/part-too-large`         | 2    | `validate`, `part start`                                                                                                                        | A plan part is over 8 KB (S1, P6).                                                                                                                                                                     |
| `policy/part-too-many-tasks`    | 2    | `validate`, `part start`                                                                                                                        | A plan part has more than 8 tasks (S1).                                                                                                                                                                |
| `policy/do-not-touch-overlap`   | 2    | `validate`, `part start`                                                                                                                        | A task's `Files:` intersects the part's `do-not-touch` (P6).                                                                                                                                           |
| `policy/placeholder`            | 2    | `validate`, `part start`, `dispatch build`                                                                                                      | An executable field contains `TODO`, `<fill in>` or `...` (P6, P7).                                                                                                                                    |
| `policy/budget-exhausted`       | 2    | `attempt open`                                                                                                                                  | The loop's budget is used up; `instead` names the next rung of the ladder (A-drabina).                                                                                                                 |
| `policy/oscillation`            | 2    | `attempt open`                                                                                                                                  | A finding fingerprint appeared in `policy.oscillation.threshold` failed attempts of the round (`kernel-loops`); the ladder is shortened.                                                               |
| `policy/no-open-ticket`         | 2    | `attempt close`, `log add`, `log ingest`, `dispatch build`, `rules show`, `evidence record`                                                     | No open ticket for the task, or the ticket named does not match.                                                                                                                                       |
| `policy/ticket-open`            | 2    | `change park`, `change takeover`, `change checkpoint`, `change close`, `part done`, `part split`, `attempt open`, `commit`, `hooks session-end` | A ticket is still open; subagents may still be writing.                                                                                                                                                |
| `policy/package-too-large`      | 2    | `dispatch build`                                                                                                                                | The package exceeds 12 KB (K4).                                                                                                                                                                        |
| `policy/do-not-touch`           | 2    | `attempt close`, `commit`                                                                                                                       | The real diff touches a `do-not-touch` path (P6).                                                                                                                                                      |
| `policy/entries-missing`        | 2    | `attempt close`, `log ingest`                                                                                                                   | The envelope declares ledger or evidence ids that do not exist under this ticket.                                                                                                                      |
| `policy/stale-evidence`         | 2    | `attempt close`, `evidence check`                                                                                                               | The evidence manifest is older than the last code change (P5).                                                                                                                                         |
| `policy/missing-citation`       | 2    | `done`, `attempt close`, `evidence record`                                                                                                      | A PASS verdict cites no value that resolves inside the recorded evidence (T4).                                                                                                                         |
| `policy/invalid-transition`     | 2    | `change resume`, `done`, `change park`, `change takeover`, `part start`, `part done`, `part split`, `log resolve`, `attempt open`               | The Change or part is not in a state from which the verb applies, or the artifact is marked done by another command; `why` names the current state or that command.                                    |
| `policy/git-in-progress`        | 2    | `change checkpoint`, `commit`, `hooks session-end`                                                                                              | A rebase, merge or cherry-pick is in progress (V1-4).                                                                                                                                                  |
| `policy/git-hook-failed`        | 2    | `commit`, `change checkpoint`                                                                                                                   | A git hook of the repository rejected the kernel's commit; `why` carries the hook's first output line and no commit was created.                                                                       |
| `policy/nothing-to-commit`      | 2    | `commit`                                                                                                                                        | Neither the code nor the Change directory changed since the last commit for this task.                                                                                                                 |
| `policy/spec-invalid`           | 2    | `validate`, `spec delta check`, `spec merge`                                                                                                    | A delta breaks the format: `Scenario:` prefix, missing WHEN / THEN, a scenario lost without `REMOVED` (D2b).                                                                                           |
| `policy/spec-conflict`          | 2    | `change close`, `spec merge`                                                                                                                    | Two deltas edit the same requirement differently; `why` names both.                                                                                                                                    |
| `policy/merge-hash-mismatch`    | 2    | `change close`, `spec merge`, `doctor`                                                                                                          | A spec file's content hash differs from its `bdk-merge-hash` (V1-7).                                                                                                                                   |
| `policy/unknown-config-key`     | 2    | `config show`, `config check`, `config set`, `ctx skill`                                                                                        | A key no module schema declares; `why` lists the keys.                                                                                                                                                 |
| `policy/config-invalid`         | 2    | `config show`, `config check`, `config set`, `ctx skill`, `import`                                                                              | A value fails its module schema.                                                                                                                                                                       |
| `policy/profile-downgrade`      | 2    | `change resume`                                                                                                                                 | The requested profile is smaller than the current one (R-profil).                                                                                                                                      |
| `policy/detached-head`          | 2    | `change new`, `change resume`                                                                                                                   | `HEAD` is detached, so there is no branch to bind a Change to; `instead` names `git switch <branch>`.                                                                                                  |
| `policy/rule-format`            | 2    | `rules check`, `rules add`, `rules import`, `rules export`                                                                                      | A rule lacks its `[PREFIX-n]`, or a `knowledge` rule with a fact lacks `source` / `verified` (T5).                                                                                                     |
| `policy/generated-drift`        | 2    | `export agents`                                                                                                                                 | A `--check` run found a committed generated file that differs from the generator output, or one that is missing; `why` names the files.                                                                |
| `policy/duplicate-rule-id`      | 2    | `rules check`, `rules import`, `import`                                                                                                         | Two rules carry the same id, typically after a parallel close (V1-6).                                                                                                                                  |
| `guard/subagent-git`            | 2    | `hooks pre-tool`                                                                                                                                | A subagent ran a destructive or history-writing git command (T3).                                                                                                                                      |
| `guard/subagent-kernel-command` | 2    | `hooks pre-tool`                                                                                                                                | A subagent invoked an `orchestrator` or `hook` class command (`kernel-cli`, Availability classes).                                                                                                     |
| `guard/hooks-from-bash`         | 2    | `hooks pre-tool`                                                                                                                                | Any thread invoked `bdk.mjs hooks` through Bash (T1 defence in depth).                                                                                                                                 |
| `guard/spec-dir-write`          | 2    | `hooks pre-tool`                                                                                                                                | A tool call writes under `.bdk/specs/` (V1-7).                                                                                                                                                         |
| `guard/kernel-unavailable`      | 2    | the `\|\| exit 2` branch                                                                                                                        | Not emitted by the kernel: the shell fragment produces it when Node or the bundle is missing. Listed so that the catalogue names every reason a caller can see.                                        |
| `state/corrupted-index`         | 4    | every Change-scoped command                                                                                                                     | The SQLite index cannot be opened or disagrees with the files after a lazy rebuild.                                                                                                                    |
| `state/ledger-invalid`          | 4    | every Change-scoped command                                                                                                                     | A committed entry, attempt or manifest fails its schema (T14).                                                                                                                                         |
| `state/trailer-mismatch`        | 4    | `change close`, `change takeover`, `part done`, `rebuild`                                                                                       | Progress derived from git trailers disagrees with the committed attempt records.                                                                                                                       |
| `state/change-dir-missing`      | 4    | every Change-scoped command                                                                                                                     | The branch marker names a Change whose directory is gone.                                                                                                                                              |
| `runtime/node-version`          | 5    | every command except `version` and `doctor`                                                                                                     | Node is below 22.13.0 (HOST-FACTS `node-sqlite-min`); `instead` carries the install line.                                                                                                              |
| `runtime/not-a-repo`            | 5    | every command except `version`                                                                                                                  | The project root is not inside a git work tree.                                                                                                                                                        |
| `runtime/git-missing`           | 5    | every command that shells out to git                                                                                                            | No `git` executable on `PATH`.                                                                                                                                                                         |
| `kernel/not-implemented`        | 2    | any stubbed command                                                                                                                             | The command exists in the index but its owner task has not landed; `instead` names the task.                                                                                                           |

#### Scenario: refusal in JSON

- **WHEN** a command refuses under `--json`
- **THEN** stdout is one object with exactly `refused`, `rule`, `why` and `instead`, and the exit code is 2, 3, 4 or 5 by the class of `rule`

#### Scenario: refusal in text mode

- **WHEN** a command refuses without `--json`
- **THEN** stdout is the four labelled lines (`refused:`, `why:`, one `instead:` per action) and nothing else

#### Scenario: undeclared rule

- **WHEN** a command record declares a rule in `refusals` that the catalogue does not list
- **THEN** the contract test fails

#### Scenario: stamped field as an undeclared flag

- **WHEN** `bdk log add decision "x" --ref a.ts --author someone` runs
- **THEN** the exit code is 3 with `rule: input/forbidden-field`, not `input/unknown-flag`

#### Scenario: git hook rejects a kernel commit

- **WHEN** the repository's `pre-commit` hook exits 1 and `bdk commit 02-3` runs
- **THEN** the exit code is 2 and the error object carries `rule: policy/git-hook-failed`

### Requirement: Availability classes

Each command SHALL carry exactly one availability class in the index, and the `hooks pre-tool` guard SHALL enforce the classes by exact verb.

Each command carries exactly one class in the index (`availability`). The `hooks pre-tool` guard (T24) reads the same index: it denies a subagent (hook input carries `agent_id`) every command whose verb is `orchestrator` or `hook`, and denies every thread a Bash invocation of a `hook` command. The match is by exact verb from the index, not by group prefix, so a read-only verb inside a guarded group (`change status`, `attempt list`, `part list`) stays callable from a subagent; the design's group-level deny list ("`bdk.mjs commit|attempt|part|change|log ingest|spec merge|hooks`") is the same set at verb granularity, except `log ingest`, which every role calls to store its report (T23-D14). The deny reason names the verb and tells the agent to return `blocked` with the cause instead of working around it.

| Class          | Who may call                                              | Guarded                                                                 | Verbs                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orchestrator` | The main thread (the orchestrating skill) and tests.      | Yes: denied to subagents by `hooks pre-tool`.                           | Every command that writes into the Change, the working tree or the configuration: `change new\|resume\|park\|takeover\|checkpoint\|close`, `done`, `part start\|done\|split`, `attempt open\|close`, `log resolve\|route`, `dispatch build`, `spec merge`, `config set`, `commit`, `rules add\|import\|export`, `export agents`, `rebuild`, `import`. |
| `agent`        | Subagents and the main thread.                            | No.                                                                     | The operations a role needs (T2, T3, T23-D14): `log add\|ingest`, `log show`, `dispatch show`, `rules show`, `evidence record`, `ctx skill\|startup`.                                                                                                                                                                                                 |
| `hook`         | The host only, through `hooks.json` or skill frontmatter. | Yes: a Bash invocation is denied in every thread (T1 defence in depth). | `hooks session-start\|session-end\|prompt-expansion\|pre-tool\|skill-exists`.                                                                                                                                                                                                                                                                         |
| `read`         | Anyone.                                                   | No.                                                                     | Read-only queries with no side effect beyond the lazy index rebuild: `next`, `explain`, `validate`, `measure`, `change status\|list`, `part list`, `attempt list`, `log list`, `evidence check`, `spec delta check\|diff`, `config show\|check\|schema`, `query`, `rules check\|explain\|prune\|stats`, `doctor`, `version`.                          |

`hooks prompt-expansion` is the only writer of `source: user` transition entries; there is no `approve`, no `gate pass`, and `log add` cannot produce `source: user` (T1, P1, S8). A model that wants a gate passed has exactly one option: render the gate status and stop, so that the user types the next stage command.

**Cross-check with the state contract (T14).** Every command that writes lists the Change directory paths it may touch in `writes[]` (index field); `read` commands have an empty list. `kernel-state`'s write map names a writer for every file in the Change directory and checks that each kernel writer is an `orchestrator`, `agent` or `hook` command here, never a `read` one, whose `writes[]` covers the path. The other writers are stage skills and roles that write artifact files (design and plan artifacts, `spec-delta/`) through the host's file tools; the kernel validates those files at `done` and at `attempt close`.

#### Scenario: subagent calls an orchestrator verb

- **WHEN** a `PreToolUse` payload with `agent_id` carries a Bash command invoking an `orchestrator` verb such as `bdk.mjs commit`
- **THEN** `hooks pre-tool` denies with `guard/subagent-kernel-command` and the reason names the verb

#### Scenario: subagent calls a read verb of a guarded group

- **WHEN** a subagent invokes `bdk.mjs attempt list`
- **THEN** `hooks pre-tool` passes, because the match is by verb, not by group

#### Scenario: hook verb from Bash

- **WHEN** any thread invokes `bdk.mjs hooks ...` through Bash
- **THEN** `hooks pre-tool` denies with `guard/hooks-from-bash`

### Requirement: Conventions

Success output, list pages, identifiers, timestamps, idempotence and the refusal-versus-finding split SHALL follow these conventions in every command.

- **Success output is a plain object.** No envelope: the `--json` output of a command is the object its schema under `schema/cli/output/` describes. Optional fields are absent when unknown, never `null`. Enumerations are lowercase words. Text mode renders the same data; only JSON is the contract.
- **List pages.** Every `list` verb and every command that returns a collection uses `schema/cli/common/list-page.json`: `items[]`, `total` (the count before truncation), `truncated` (boolean), and `for` (the `--for` filter as given, absent when none). The default page is the first 100 items, which is the design's "<= 100 lines" rule; `--all` lifts it. A list verb's text mode prints at most 100 lines for the same reason, ending in a line that names `--all`; every other command prints its whole text, so a `show` body is never cut. `--for <ref>` narrows a list to what references a task (`02-3`), a part (`02`) or a file path; the list verbs that accept it say so in their entry.
- **Full bodies only via `show`.** `list` returns summaries (id, type, summary, status, refs). `show <id>` returns the whole entry, package or attempt record. Dumping the whole state needs `query` with `--all`.
- **Kernel-stamped fields.** `id`, `at`, `author` and `source` on ledger entries, tickets, attempts and manifests are stamped by the kernel from its clock, git config and the ticket's role (P1), and so is every other field `kernel-state` marks as stamped (for example a `learning` entry's `fingerprint`). They appear in outputs and never in inputs; passing one is `input/forbidden-field`. `source: user` exists only on the stage-transition path (`hooks prompt-expansion`); `source: policy` only when `policy.gates.<gate>: auto` passes a gate (T02 decision R-9); `source: inferred` only from `change new --inferred`.
- **Identifiers.** Change ids, ledger ids (`L-`), ticket ids (`A-`), evidence ids (`E-`) and rule ids (`[PREFIX-n]`) are opaque strings to callers. Their format is fixed by `kernel-state` (Identifiers): the prefix followed by eight random characters of `[0-9a-z]`, non-sequential, with no allocator or lock; Change ids are `<yyyy-mm-dd>-<slug>`. Within the active Change an id is bare (`L-m2x9v7qa`); across Changes it is qualified (`<changeId>/L-m2x9v7qa`). Task ids are `<part>-<n>` (`02-3`), part ids two digits (`02`), artifact ids the node names of `pipeline.yaml` (`design`, `plan-verify`, `gate:design`). Ids in the examples of these specs are illustrative.
- **Time, hashes, sizes, paths.** `at` and every other timestamp is ISO 8601 UTC with seconds, `2026-09-25T09:41:07Z`. Hashes are `sha256:<64 hex>`. Sizes are bytes. Paths in outputs are relative to the project root with `/` separators; inputs accept absolute paths inside the project.
- **Idempotence and deduplication.** A command that would create an object identical by its dedupe key returns the existing object with `deduplicated: true` and exits 0 (`log add`, `evidence record`, `change checkpoint` when nothing changed). Commands that transition state refuse a repeated transition with `policy/invalid-transition` rather than silently succeeding, except where an entry says otherwise (`hooks prompt-expansion` on an already passed gate passes without writing, S5).
- **Refusal versus finding.** The kernel refuses (exit 2) when proceeding would break an invariant: a forbidden path, a missing ticket, a stale manifest. It records a `finding` entry and exits 0 when the deviation is information for the human: a file outside a task's `Files:`, an uncategorised verifier blocker (downgraded to `observation` with `review: true`, P8). Each entry names which of the two it does.
- **Clock and budgets are not arguments.** No command takes a timestamp, an author, a budget or a model name as input; budgets and the escalation model come from policy (T22), time from the kernel.

#### Scenario: list page cap

- **WHEN** a `list` verb runs without `--all` over more than 100 matching items
- **THEN** `items` holds the first 100, `total` the full count and `truncated` is `true`

#### Scenario: show body past 100 lines

- **WHEN** `dispatch show` prints a package of more than 100 lines in text mode
- **THEN** stdout is the whole file, byte for byte, with no truncation line

#### Scenario: kernel-stamped field in input

- **WHEN** `log add` or `log ingest` receives `id`, `at`, `author` or `source` as input
- **THEN** the exit code is 3 with `rule: input/forbidden-field`

#### Scenario: duplicate by dedupe key

- **WHEN** `log add`, `evidence record` or `change checkpoint` would create an object identical by its dedupe key
- **THEN** the existing object is returned with `deduplicated: true` and the exit code is 0
