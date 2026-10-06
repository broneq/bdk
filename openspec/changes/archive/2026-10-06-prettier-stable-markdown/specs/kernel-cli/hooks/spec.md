## MODIFIED Requirements

### Requirement: bdk hooks session-start

SessionStart content hook: STARTUP text, configuration check, v2 layout detection, schema refresh. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks session-start`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SessionStart payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** One process instead of the three v2 SessionStart commands (a static `cat` of STARTUP, the rule-drift snapshot, `config check`). It prints the output of `ctx startup` first. In a BDK project it ends, as `stale`, the registry rows of other sessions whose agents have been silent for longer than `agents.ttl` (`kernel-state`, Agent registry), so a crashed session leaves no agent `running`. In a BDK project (a `.bdk/` directory at the project root) it then runs the validation of `config check`, which also refreshes the resolved snapshot and the offline schema copy under `.bdk/.machine/`, and the v2 layout detection of `doctor`. Every problem becomes a line after the STARTUP text: an error of the configuration (an unknown key, a removed v2 key with its replacement or reason, an invalid value, an unreadable file) is one line `[BDK] config: <why> Instead: <instead joined by "; ">`, a warning of `config check` is one line `[BDK] config warning: <path>: <message>` (except `legacy-settings`, which the layout line already names), and a v2 layout is one line `[BDK] v2 layout detected (<paths>): run /bdk:setup.` A role that would read more rules than `rules.warn-above` (`kernel-settings`, Keys of rules and specs) is one line `[BDK] rules warning: <role> reads <n> rules (rules.warn-above: <limit>); switch rules off with rules.disabled or narrow them with applies.`, counted as `rules explain` selects them for the project's `languages` with no file set, so every scoped rule counts; one line names the role with the most rules. There is no cap on the rules a package carries, so this line is how a user learns the prompts grew; rule files that fail `rules check` are left to `doctor` and add no line here. A configuration problem is content, never a STOP block, because it must not make the model stop at session start. Outside a BDK project, and outside a git work tree (a standalone command, `kernel-cli`, Invocation), it prints the STARTUP text alone. The hook starts no MCP server and registers no code graph (ADR-0001). The payload is read and ignored in T13; `source` becomes relevant with T24. Inject mode: exits 0 always, and only an internal failure is a STOP block. In a BDK project whose formatter guard is not in force (`.bdk/.prettierrc` missing, unparseable, or not the guard of `kernel-state`, Formatter guard), the first line after the STARTUP text is `[BDK] WARNING: .bdk/.prettierrc is missing or is not the BDK formatter guard, so Prettier can rewrite files under .bdk/ and break their recorded hashes. Restore it: write { "requirePragma": true, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] } to .bdk/.prettierrc and commit it.` The hook only reports: it never creates or changes the file.
- **Writes:** `.bdk/.machine/`
- **Output:** `schema/cli/output/hooks-session-start.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; configuration problems are content lines, not rules; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks session-start --json
  ```

  ```json
  {
    "content": "# BDK Shared Foundation\n...\n\n[BDK] v2 layout detected (.bdk/settings.json): run /bdk:setup.",
    "layout": "v2",
    "configProblems": 0
  }
  ```

- **Owner:** T13
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `echo "$PAYLOAD" | bdk hooks session-start` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/hooks-session-start.json`

#### Scenario: STARTUP comes first

- **WHEN** `bdk hooks session-start` runs in any directory
- **THEN** its stdout starts with the exact output of `bdk ctx startup`

#### Scenario: project still sets a removed key

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true` and the hook runs
- **THEN** the exit code is 0, the output holds no `BDK STOP` line, and after the STARTUP text one `[BDK] config:` line names `features.serena` and its reason

#### Scenario: policy/unknown-config-key

- **WHEN** `.bdk/settings.yaml` sets a key no module schema declares and the hook runs
- **THEN** the exit code is 0, the output holds no `BDK STOP` line, and after the STARTUP text one `[BDK] config:` line carries the `why` and `instead` of `policy/unknown-config-key`

#### Scenario: policy/config-invalid

- **WHEN** a value fails its module schema and the hook runs
- **THEN** the exit code is 0, the output holds no `BDK STOP` line, and after the STARTUP text one `[BDK] config:` line carries the `why` and `instead` of `policy/config-invalid`

#### Scenario: known keys stay silent

- **WHEN** `.bdk/settings.yaml` sets only registered keys, carries the current modeline, no v2 marker exists and `.bdk/.prettierrc` holds the formatter guard
- **THEN** stdout equals the output of `bdk ctx startup`

#### Scenario: not a BDK project

- **WHEN** the hook runs in a git work tree without `.bdk/`, or in a directory outside any git work tree
- **THEN** the exit code is 0, stdout equals the output of `bdk ctx startup` and nothing is written

#### Scenario: no MCP work at session start

- **WHEN** `bdk hooks session-start` runs in any project
- **THEN** it starts no `uvx` process, registers no code graph, and its output contains no line about `uvx` or an MCP server

#### Scenario: many rules warned

- **WHEN** `.bdk/settings.yaml` sets `rules.warn-above: 10` in a project with `languages: [typescript]`, and `bdk hooks session-start` runs
- **THEN** the exit code is 0 and the content ends with a line starting `[BDK] rules warning: implementer reads`, naming `rules.warn-above: 10`

#### Scenario: stale rows of a crashed session

- **WHEN** the registry holds a `running` row of another session whose heartbeat is an hour old and the hook runs
- **THEN** the row is `ended` with `ended-by: stale`, and the output is unchanged

#### Scenario: formatter guard missing

- **WHEN** `bdk hooks session-start` runs in a BDK project without `.bdk/.prettierrc`
- **THEN** the exit code is 0, the output holds no `BDK STOP` line, the first line after the STARTUP text starts with `[BDK] WARNING: .bdk/.prettierrc is missing`, and `.bdk/.prettierrc` still does not exist

#### Scenario: formatter guard without the pragma option

- **WHEN** `.bdk/.prettierrc` holds `{ "requirePragma": true }` without the override, and the hook runs
- **THEN** the content carries the same `[BDK] WARNING:` line and the file's bytes are unchanged

#### Scenario: no guard warning outside a BDK project

- **WHEN** the hook runs in a git work tree without `.bdk/`
- **THEN** stdout equals the output of `bdk ctx startup`
