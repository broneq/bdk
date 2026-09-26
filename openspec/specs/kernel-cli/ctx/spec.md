# kernel-cli/ctx Specification

## Purpose

Prompt context (`ctx`). The two inject-mode composers that replace the v2 injection scripts: `skill` for a skill's context lines, `startup` for the session foundation. Roles have no composer: a role is a skill, and `dispatch build` embeds its body.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/not-found",
  "why": "debugg is not a skill with a BDK context",
  "instead": [
    "bdk ctx skill debug",
    "check the skill name in the context lines"
  ]
}
```

## Requirements

### Requirement: bdk ctx skill

Compose the prompt context a skill's context line injects: rule sets, language rules, fragments, tool entries, plugin files. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx skill <name>`
- **Availability:** `agent`
- **Mode:** `inject`
- **Arguments:**
  - `<name>` (required). Skill name, e.g. debug, create-plan.
- **Behaviour:** Replaces `inject.py`, `inject-rules.py` and `inject-language-rules.py` (Configuration section). `<name>` selects an entry of the context manifest the kernel bundles: an ordered list of parts per skill. A skill is in the manifest exactly when its `SKILL.md` carries the context lines (`kernel-cli`, Output modes). The output is Markdown: the heading `## BDK context: <name>`, then one `### <title>` section per part in manifest order. Part kinds:
  - `rules`: the prompt value `rules/<category>` resolved across the layers (`kernel-settings`, Prompt values), under `### Rules: <category>`. Rule sets are selected by file; selection by ID and `applies` arrives with T31.
  - `language-rules`: for each entry of `languages` in order, the prompt value `rules/languages/<language>` under `### Language rules: <language>`; a language without a value is skipped, and without any the part is omitted.
  - `fragment`: a choice between prompt values under a fixed title. The only fragment in T13 is `decision`, titled `### Asking the user`: `fragments/decision/lavish` when `features.lavish` is true and an executable `lavish-axi` is on `PATH`, otherwise `fragments/decision/ask-user` (R-11).
  - `tools`: the entries of `tools.<group>` (`test`, `lint` or `build`) under `### Project commands: <group>`, rendered as `bdk config show tools.<group>` renders them in text mode, including `when`; an empty group renders the line `none configured`.
  - `file`: a file of the plugin, verbatim, under the title the manifest gives it (the former `cat` blocks of `cr`, `pr-review` and `bdk-implementer-return-contract`).
  - Configuration: resolved as `config show` resolves it. An unknown key and an invalid value are STOP blocks (`policy/unknown-config-key`, `policy/config-invalid`), because context composed from a configuration the user did not mean is worse than none. A removed v2 key (`kernel-settings`, Removed v2 keys) has no effect on the output; `config check` and `hooks session-start` report it. Inject mode: exits 0 always; every error becomes a STOP block.
- **Writes:** nothing
- **Output:** `schema/cli/output/ctx.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: `input/not-found`, `policy/unknown-config-key`, `policy/config-invalid`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk ctx skill design --json
  ```

  ```json
  {
    "content": "## BDK context: design\n\n### Rules: architecture\n...",
    "parts": [
      {
        "kind": "rules",
        "source": "rules/architecture"
      },
      {
        "kind": "rules",
        "source": "rules/engineering-judgment"
      },
      {
        "kind": "fragment",
        "source": "fragments/decision/ask-user"
      }
    ]
  }
  ```

- **Owner:** T13
- **Slice:** `ctx`

#### Scenario: example run

- **WHEN** `bdk ctx skill design --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/ctx.json`

#### Scenario: input/not-found

- **WHEN** `<name>` is not an entry of the context manifest
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `input/not-found`

#### Scenario: policy/unknown-config-key

- **WHEN** a key no module schema declares
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `policy/unknown-config-key`

#### Scenario: policy/config-invalid

- **WHEN** a value fails its module schema
- **THEN** the exit code is 0 and the output is a STOP block whose `why` and `instead` are those of `policy/config-invalid`

#### Scenario: removed v2 key does not change the context

- **WHEN** `bdk ctx skill design` runs once in a project whose `.bdk/settings.yaml` sets `features.code-review-graph: true` and once without that key
- **THEN** both runs exit 0 with byte-identical stdout, and neither contains a STOP block

#### Scenario: Lavish off

- **WHEN** `.bdk/settings.yaml` sets `features.lavish: false` and `bdk ctx skill design` runs
- **THEN** the `Asking the user` section holds the resolved value of `fragments/decision/ask-user` and no text of `fragments/decision/lavish`

#### Scenario: Lavish on and installed

- **WHEN** `features.lavish` is true, `lavish-axi` is on `PATH` and `bdk ctx skill design` runs
- **THEN** the `Asking the user` section holds the resolved value of `fragments/decision/lavish`

#### Scenario: project extends a rule set

- **WHEN** `.bdk/prompts/rules/security.md` has `mode: extends` and `bdk ctx skill create-plan` runs
- **THEN** the `Rules: security` section holds the plugin's `rules/security.md` body followed by the project file's body

#### Scenario: language rules

- **WHEN** `languages` is `[typescript, cobol]`, the plugin ships `rules/languages/typescript.md` and no layer has `rules/languages/cobol`
- **THEN** `bdk ctx skill create-plan` holds a `Language rules: typescript` section and no section for `cobol`

#### Scenario: tool entries

- **WHEN** `.bdk/settings.yaml` declares a `tools.test` entry with `when` text and `bdk ctx skill debug` runs
- **THEN** the `Project commands: test` section holds that entry as `bdk config show tools.test` prints it, including the `when` text

### Requirement: bdk ctx startup

Render the STARTUP instructions, including the agents table generated from agent frontmatter (P11). The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx startup`
- **Availability:** `agent`
- **Mode:** `inject`
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Reads the plugin's `STARTUP_INSTRUCTIONS.md` and replaces the lines between the markers `<!-- bdk:agents-table -->` and `<!-- /bdk:agents-table -->` with a table generated from the frontmatter of every `agents/*.md` of the plugin, sorted by `name`: one row per agent with the columns `subagent_type` (`bdk:<name>`), `Model` (`model`) and `When to pick` (`description`). The markers stay in the output. The command reads no configuration and needs no git work tree (`kernel-cli`, Invocation). A content test keeps the committed `STARTUP_INSTRUCTIONS.md` byte-identical to this output (P11, T6), so the file in the repository is always the rendered one. `hooks session-start` prints the same text.
- **Writes:** nothing
- **Output:** `schema/cli/output/ctx.json` for `--json`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0` always (inject mode). Rules rendered as a STOP block: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk ctx startup --json
  ```

  ```json
  {
    "content": "# BDK Shared Foundation\n...",
    "parts": [
      {
        "kind": "startup",
        "source": "STARTUP_INSTRUCTIONS.md"
      },
      {
        "kind": "agents-table",
        "source": "agents/"
      }
    ]
  }
  ```

- **Owner:** T13
- **Slice:** `ctx`

#### Scenario: example run

- **WHEN** `bdk ctx startup --json` runs as in the example
- **THEN** the exit code is 0 and stdout is the composed Markdown, or under `--json` an object that validates against `schema/cli/output/ctx.json`

#### Scenario: table lists every agent file

- **WHEN** `bdk ctx startup` runs on the plugin
- **THEN** the agents table has exactly one row per file in `agents/`, each naming `bdk:<name>` with that file's `model` and `description`

#### Scenario: committed file is the rendered file

- **WHEN** the content test compares `STARTUP_INSTRUCTIONS.md` with the output of `bdk ctx startup`
- **THEN** they are byte-identical

#### Scenario: outside a git work tree

- **WHEN** `bdk ctx startup` runs in a directory that is not inside a git work tree
- **THEN** the exit code is 0 and stdout is the rendered STARTUP text

#### Scenario: policy/unknown-config-key

- **WHEN** `.bdk/settings.yaml` sets a key no module schema declares and `bdk ctx startup` runs
- **THEN** the exit code is 0 and stdout is the rendered STARTUP text without a STOP block, because the command reads no configuration
