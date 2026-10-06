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

Compose the prompt context a skill's context line injects: the rules of a stage, fragments, tool entries, setup coverage, plugin files. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx skill <name>`
- **Availability:** `agent`
- **Mode:** `inject`
- **Arguments:**
  - `<name>` (required). Skill name, e.g. design, plan.
- **Behaviour:** Replaces `inject.py`, `inject-rules.py` and `inject-language-rules.py` (Configuration section). `<name>` selects an entry of the context manifest the kernel bundles: an ordered list of parts per skill. A skill is in the manifest exactly when its `SKILL.md` carries the context lines (`kernel-cli`, Output modes). The output is Markdown: the heading `## BDK context: <name>`, then one `### <title>` section per part in manifest order. Part kinds:
  - `rules`: the Selection for the stage the manifest entry names (`kernel-cli/rules`, bdk rules show, Selection, and Stage readers), over the work tree files, bundle and project rules together, under `### Rules`, one line `- [<id>] <text>` each in selection order, a rule whose `paths` is not `["**"]` followed by ` (paths: <globs>)`. A rule in `rules.disabled`, a rule of another stage and a language pack outside `languages` are left out; the part is omitted when nothing is selected. The entries `design` and `adr` name the stage `design`, and `plan` names `plan`; no other entry has a `rules` part.
  - `fragment`: a choice between prompt values under a fixed title. The only fragment in T13 is `decision`, titled `### Asking the user`: `fragments/decision/lavish` when `features.lavish` is true and an executable `lavish-axi` is on `PATH`, otherwise `fragments/decision/ask-user` (R-11).
  - `tools`: the entries of `tools.<group>` (`test`, `lint` or `build`) under `### Project commands: <group>`, rendered as `bdk config show tools.<group>` renders them in text mode, including `when`; a group declared none renders the line `declared none (tools.<group>: none)`, a `test` or `lint` group no layer sets the line `unset: no command configured`, and an empty `tools.build` the line `none configured` (`kernel-settings`, Tool entries).
  - `concurrency`: the resolved `execution.concurrency` under `### Concurrency`, as the sentence `Run at most <n> agents at once.` (T23-D52); the swarm skill's only part.
  - `file`: a file of the plugin, verbatim, under the title the manifest gives it (`pr-review`'s comment templates).
  - `verifier-policy`: the resolved `policy.verifier.blocking-categories` and `policy.verifier.not-a-fail` under `### Blocking categories (P8)`, one line `- <id>: <description>` per category, then the not-a-fail entries in the same line form under `#### Not a fail`, the same lists a `verifier` package carries (T42). `design` and `plan` check their own draft against them before verification, and `cr` triages against them.
  - `setup-coverage`: every leaf key of the registry grouped by its setup class (`kernel-settings`, Setup classification) under `### Setup coverage`, with `#### Derived`, `#### Asked` and `#### Not set by setup` in that order, one line `- <key>: <value> (<origin>)` per key in registry order. `<value>` renders a scalar as is, an object (`tracker`) as JSON, an array merged by id as its ids joined by `, `, any other array as its items joined by `, ` (`[]` when empty), and a free-form mapping as the count of its entries; an unset key renders `unset`. `<origin>` is the layer the value comes from (`default`, `global`, `project` or `local`), or for a merged array the highest layer that contributes to it. The setup skill's part, so the skill derives and asks exactly the keys its classes name and reports the rest.
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
    "content": "## BDK context: design\n\n### Rules\n...",
    "parts": [
      {
        "kind": "rules",
        "source": "stage:design"
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

#### Scenario: old rule prompt file

- **WHEN** `.bdk/prompts/rules/security.md` exists and `bdk ctx skill create-plan` runs
- **THEN** the output is a STOP block with `policy/unknown-config-key`, whose `why` names the file and says that project rules live in `.bdk/rules/` and BDK rules are switched off with `rules.disabled`

#### Scenario: language rules

- **WHEN** `languages` is `[typescript, cobol]`, the plugin ships a pack under `rules/languages/typescript/` and none for `cobol`, and the work tree holds `src/app.ts`
- **THEN** the `### Rules` section of `bdk ctx skill plan` holds the `BDK-TS` rules and no line names `cobol`

#### Scenario: tool entries

- **WHEN** `.bdk/settings.yaml` declares a `tools.test` entry with `when` text and `bdk ctx skill debug` runs
- **THEN** the `Project commands: test` section holds that entry as `bdk config show tools.test` prints it, including the `when` text

#### Scenario: swarm context carries the concurrency

- **WHEN** no layer sets `execution.concurrency` and `bdk ctx skill swarm` runs
- **THEN** the output holds `### Concurrency` with `Run at most 5 agents at once.`

#### Scenario: rules carry their ids

- **WHEN** `bdk ctx skill plan` runs with `rules.disabled: [BDK-CQ-2]`
- **THEN** the `### Rules` section lists each remaining `CQ` rule as `- [BDK-CQ-<n>] <text>` and no line for `BDK-CQ-2`

#### Scenario: project extends a rule set

- **WHEN** the project holds `API-1` with `paths: [src/api/**]` and `stages: [plan, review]`, the work tree holds `src/api/login.ts`, and `bdk ctx skill plan` runs
- **THEN** the `### Rules` section holds `- [API-1] <text> (paths: src/api/**)`

#### Scenario: verifier policy in the plan context

- **WHEN** `policy.verifier.blocking-categories` resolves to the default list and `bdk ctx skill plan` runs
- **THEN** the output holds `### Blocking categories (P8)` with one line per category id of that list and the `#### Not a fail` items, in the order of the resolved settings

#### Scenario: no meta-skill context

- **WHEN** `bdk ctx skill bdk-rules-security` runs
- **THEN** the output is a STOP block with `input/not-found`, because the manifest holds no `bdk-*` skill

#### Scenario: tool group states in the context

- **WHEN** `tools.test` is configured, `tools.lint` is `none`, `tools.build` is not set, and `bdk ctx skill setup` runs
- **THEN** `Project commands: test` lists the entries, `Project commands: lint` holds `declared none (tools.lint: none)` and `Project commands: build` holds `none configured`

#### Scenario: setup coverage on an empty project

- **WHEN** no layer file exists and `bdk ctx skill setup` runs
- **THEN** the output holds `### Setup coverage` after the three `Project commands` sections; `#### Derived` lists `tools.test: unset (default)` and `spec.normative-word: SHALL (default)`, `#### Asked` lists `policy.gates.design: manual (default)` and `review.risks: auth, migration, secrets, public-api, dependencies, configuration (default)`, and `#### Not set by setup` lists `policy.budgets.task-redispatch: 3 (default)` and `prompts.files.<key>: 0 (default)`

#### Scenario: setup coverage names the layer

- **WHEN** `.bdk/settings.yaml` sets `policy.gates.review: auto` and `.bdk/settings.local.yaml` sets `diagnostics.verbose: true`, and `bdk ctx skill setup` runs
- **THEN** `#### Asked` holds `policy.gates.review: auto (project)` and `#### Not set by setup` holds `diagnostics.verbose: true (local)`

#### Scenario: a rule of another stage stays out

- **WHEN** the project holds `API-1` with `paths: [src/api/**]` and `stages: [plan, review]`, the work tree holds `src/api/login.ts`, and `bdk ctx skill design` runs
- **THEN** the output holds no line for `API-1` and no `BDK-PL` rule

#### Scenario: language pack without matching files

- **WHEN** `languages` is `[react]` and the work tree holds no `.jsx` or `.tsx` file, and `bdk ctx skill plan` runs
- **THEN** the output holds no `BDK-REACT` rule

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

### Requirement: bdk ctx craft

Print an installed `bdk-craft` skill for an agent that cannot load skills itself. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx craft <name>`
- **Availability:** `agent`
- **Mode:** `command`
- **Arguments:**
  - `<name>` (required). A craft skill name, e.g. tdd, debugging.
- **Behaviour:** Finds the `SKILL.md` of the craft skill `<name>` in this order and takes the first hit: `plugins/bdk-craft/skills/<name>/` under the plugin root of the running kernel (a checkout of this repository); then `~/.claude/plugins/cache/<marketplace>/bdk-craft/<version>/skills/<name>/` across every marketplace, the highest `<version>` by semantic version first. Only the directory layout is read, never the host's plugin bookkeeping files. The output is Markdown: the heading `## Craft: <name>`, the skill body without its frontmatter and with its headings one level down, then each file under the skill's `references/` in name order under `### references/<file>`, so the agent gets what the skill links without resolving a path. The command reads no configuration, needs no Change and no git work tree.
- **Writes:** nothing
- **Output:** `schema/cli/output/ctx.json` for `--json`, with one part of kind `craft` whose `source` is `bdk-craft/<name>`; Markdown otherwise (`kernel-cli`, Output modes).
- **Exit codes and rules:** `0, 3`. Specific rules: `input/not-found` when no `bdk-craft` install holds `<name>`, its `why` naming the paths searched; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk ctx craft tdd --json
  ```

  ```json
  {
    "content": "## Craft: tdd\n\n### Red\n...",
    "parts": [
      {
        "kind": "craft",
        "source": "bdk-craft/tdd"
      }
    ]
  }
  ```

- **Owner:** T42
- **Slice:** `ctx`

#### Scenario: example run

- **WHEN** `bdk ctx craft tdd --json` runs with `bdk-craft` in the plugin cache
- **THEN** the exit code is 0 and `content` starts with `## Craft: tdd` followed by the skill body without frontmatter

#### Scenario: repository checkout first

- **WHEN** the kernel runs from a checkout that holds `plugins/bdk-craft/skills/tdd/SKILL.md` and the cache holds another version
- **THEN** the output is the checkout's skill

#### Scenario: highest cached version

- **WHEN** the cache holds `bdk-craft` versions `0.2.0` and `0.10.0`, both with `tdd`
- **THEN** the output is the `0.10.0` skill

#### Scenario: references inlined

- **WHEN** the skill has `references/builders.md`
- **THEN** the output ends with a `### references/builders.md` section holding that file

#### Scenario: input/not-found

- **WHEN** `bdk ctx craft tdd` runs and no `bdk-craft` install holds `tdd`
- **THEN** the exit code is 3 and the error is `input/not-found`, its `why` naming the searched paths
