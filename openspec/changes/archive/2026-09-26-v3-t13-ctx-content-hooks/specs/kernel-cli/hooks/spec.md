# Spec Delta

## MODIFIED Requirements

### Requirement: bdk hooks session-start

SessionStart content hook: STARTUP text, configuration check, v2 layout detection, schema refresh. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks session-start`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - stdin: SessionStart payload (`kernel-cli/hooks`, Hook payloads).
- **Behaviour:** One process instead of the three v2 SessionStart commands (a static `cat` of STARTUP, the rule-drift snapshot, `config check`). It prints the output of `ctx startup` first. In a BDK project (a `.bdk/` directory at the project root) it then runs the validation of `config check`, which also refreshes the resolved snapshot and the offline schema copy under `.bdk/.machine/`, and the v2 layout detection of `doctor`. Every problem becomes a line after the STARTUP text: an error of the configuration (an unknown key, a removed v2 key with its replacement or reason, an invalid value, an unreadable file) is one line `[BDK] config: <why> Instead: <instead joined by "; ">`, a warning of `config check` is one line `[BDK] config warning: <path>: <message>` (except `legacy-settings`, which the layout line already names), and a v2 layout is one line `[BDK] v2 layout detected (<paths>): run bdk import.` A configuration problem is content, never a STOP block, because it must not make the model stop at session start. Outside a BDK project, and outside a git work tree (a standalone command, `kernel-cli`, Invocation), it prints the STARTUP text alone. The hook starts no MCP server and registers no code graph (ADR-0001). The payload is read and ignored in T13; `source` becomes relevant with T24. Inject mode: exits 0 always, and only an internal failure is a STOP block.
- **Writes:** `.bdk/.machine/`
- **Output:** `schema/cli/output/hooks-session-start.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; configuration problems are content lines, not rules; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  echo "$PAYLOAD" | bdk hooks session-start --json
  ```

  ```json
  {
    "content": "# BDK Shared Foundation\n...\n\n[BDK] v2 layout detected (.bdk/settings.json): run bdk import.",
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

- **WHEN** `.bdk/settings.yaml` sets only registered keys, carries the current modeline and no v2 marker exists
- **THEN** stdout equals the output of `bdk ctx startup`

#### Scenario: not a BDK project

- **WHEN** the hook runs in a git work tree without `.bdk/`, or in a directory outside any git work tree
- **THEN** the exit code is 0, stdout equals the output of `bdk ctx startup` and nothing is written

#### Scenario: no MCP work at session start

- **WHEN** `bdk hooks session-start` runs in any project
- **THEN** it starts no `uvx` process, registers no code graph, and its output contains no line about `uvx` or an MCP server

### Requirement: bdk hooks skill-exists

Skill-frontmatter UserPromptSubmit hook: warn as content when a named skill is not installed. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk hooks skill-exists <name>`
- **Availability:** `hook`
- **Mode:** `inject`
- **Arguments:**
  - `<name>` (required). Skill name as in frontmatter, e.g. caveman-commit.
  - stdin: UserPromptSubmit payload; only the presence of a name matters.
- **Behaviour:** Replaces `hooks/is-skill-exist/check.py`. Looks for a `SKILL.md` whose frontmatter `name` equals `<name>` in `skills/*/` under `~/.claude/`, under the project root's `.claude/`, under every marketplace directory `~/.claude/plugins/marketplaces/*/` and under every installed plugin version `~/.claude/plugins/cache/*/*/*/`. The last root is new: a plugin whose marketplace repository does not hold the skill at its root was reported missing by the v2 script. It relies only on the directory layout, never on the host's plugin bookkeeping files. Installed: stdout is empty. Missing: stdout is one line `[BDK] skill <name> is not installed; the skill that needs it falls back to its own behaviour.` Inject mode: exits 0 in both cases; a missing skill is a content line, never a block. Plugin-level and skill-level hooks are supported by the host; only agent-level hooks are stripped.
- **Writes:** nothing
- **Output:** `schema/cli/output/hooks-skill-exists.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk hooks skill-exists caveman-commit --json
  ```

  ```json
  {
    "name": "caveman-commit",
    "installed": false,
    "content": "[BDK] skill caveman-commit is not installed; the skill that needs it falls back to its own behaviour."
  }
  ```

- **Owner:** T13
- **Slice:** `hooks`

#### Scenario: example run

- **WHEN** `bdk hooks skill-exists caveman-commit --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/hooks-skill-exists.json`

#### Scenario: skill of an installed plugin

- **WHEN** `~/.claude/plugins/cache/caveman/caveman/2.7.0/skills/caveman-commit/SKILL.md` has `name: caveman-commit` and `bdk hooks skill-exists caveman-commit --json` runs
- **THEN** `installed` is true, `foundIn` names that file and `content` is empty

#### Scenario: missing skill

- **WHEN** no search root holds a skill named `caveman-commit`
- **THEN** the exit code is 0 and stdout is the one `[BDK] skill caveman-commit is not installed` line
