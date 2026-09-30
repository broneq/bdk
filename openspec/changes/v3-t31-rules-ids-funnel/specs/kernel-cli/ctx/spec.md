## MODIFIED Requirements

### Requirement: bdk ctx skill

Compose the prompt context a skill's context line injects: rule sets, language rules, fragments, tool entries, plugin files. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk ctx skill <name>`
- **Availability:** `agent`
- **Mode:** `inject`
- **Arguments:**
  - `<name>` (required). Skill name, e.g. debug, create-plan.
- **Behaviour:** Replaces `inject.py`, `inject-rules.py` and `inject-language-rules.py` (Configuration section). `<name>` selects an entry of the context manifest the kernel bundles: an ordered list of parts per skill. A skill is in the manifest exactly when its `SKILL.md` carries the context lines (`kernel-cli`, Output modes). The output is Markdown: the heading `## BDK context: <name>`, then one `### <title>` section per part in manifest order. Part kinds:
  - `rules`: the enabled, non-tombstone rules of the bundle's pack for `<category>` (`rule-pack`, Pack layout), under `### Rules: <category>`, one line `- [<id>] <text>` each in id order, a rule with `applies` followed by ` (applies: <globs>)`; a skill has no file set, so nothing is narrowed by `applies` (`kernel-cli/rules`, bdk rules show). A rule in `rules.disabled` is left out.
  - `project-rules`: the enabled, non-tombstone rules of `.bdk/rules/` in the same line form, under `### Project rules`; the part is omitted when there are none.
  - `language-rules`: for each entry of `languages` in order, the enabled rules of the bundle's pack under `rules/languages/<language>/` in the same line form, under `### Language rules: <language>`; a language without a pack is skipped, and without any the part is omitted.
  - `fragment`: a choice between prompt values under a fixed title. The only fragment in T13 is `decision`, titled `### Asking the user`: `fragments/decision/lavish` when `features.lavish` is true and an executable `lavish-axi` is on `PATH`, otherwise `fragments/decision/ask-user` (R-11).
  - `tools`: the entries of `tools.<group>` (`test`, `lint` or `build`) under `### Project commands: <group>`, rendered as `bdk config show tools.<group>` renders them in text mode, including `when`; an empty group renders the line `none configured`.
  - `concurrency`: the resolved `execution.concurrency` under `### Concurrency`, as the sentence `Run at most <n> agents at once.` (T23-D52); the swarm skill's only part.
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

#### Scenario: old rule prompt file

- **WHEN** `.bdk/prompts/rules/security.md` exists and `bdk ctx skill create-plan` runs
- **THEN** the output is a STOP block with `policy/unknown-config-key`, whose `why` names the file and says that project rules live in `.bdk/rules/` and BDK rules are switched off with `rules.disabled`

#### Scenario: language rules

- **WHEN** `languages` is `[typescript, cobol]`, the plugin ships a pack under `rules/languages/typescript/` and none for `cobol`
- **THEN** `bdk ctx skill create-plan` holds a `Language rules: typescript` section and no section for `cobol`

#### Scenario: tool entries

- **WHEN** `.bdk/settings.yaml` declares a `tools.test` entry with `when` text and `bdk ctx skill debug` runs
- **THEN** the `Project commands: test` section holds that entry as `bdk config show tools.test` prints it, including the `when` text

#### Scenario: swarm context carries the concurrency

- **WHEN** no layer sets `execution.concurrency` and `bdk ctx skill swarm` runs
- **THEN** the output holds `### Concurrency` with `Run at most 5 agents at once.`

#### Scenario: rules carry their ids

- **WHEN** `bdk ctx skill create-plan` runs with `rules.disabled: [BDK-CQ-2]`
- **THEN** the `### Rules: code-quality` section lists each remaining `CQ` rule as `- [BDK-CQ-<n>] <text>` and no line for `BDK-CQ-2`

#### Scenario: project extends a rule set

- **WHEN** the project holds `API-1` with `applies: [src/api/**]` and `bdk ctx skill create-plan` runs
- **THEN** a `### Project rules` section holds `- [API-1] <text> (applies: src/api/**)`
