# Spec Delta

## MODIFIED Requirements

### Requirement: No tool-tier layer

The plugin SHALL NOT ship a tool-guidance layer on top of the host's built-in tools. There are no tool-tier chain files or fragments, no `bdk-tier-*` meta-skills, no agent preload of a tier skill, and no chain markers in `STARTUP_INSTRUCTIONS.md`. The context a skill receives does not depend on a removed tier switch (`features.code-review-graph`, `features.serena`).

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `fragments/tool-tiers/` directory, no `skills/bdk-tier-*` skill, no `*.chain.json` file and no `scripts/render_startup.py`

#### Scenario: no reference to the tier layer

- **WHEN** a shipped agent, skill, fragment, rule, hook, script or `STARTUP_INSTRUCTIONS.md` is scanned
- **THEN** no agent `skills:` list names a `bdk-tier-*` skill, and no file holds a `<!-- CHAIN: ... -->` marker

#### Scenario: STARTUP is served verbatim

- **WHEN** the SessionStart hook runs in a project with or without `.bdk/settings.yaml`
- **THEN** its stdout starts with text byte-identical to `STARTUP_INSTRUCTIONS.md`, which is itself byte-identical to `bdk ctx startup`

#### Scenario: a stale chain call is visible

- **WHEN** a skill body carries a `!` line that runs `inject.py`, with or without `--chain`
- **THEN** `pnpm skill-check` reports a wrapper form error and the skill context content test fails

#### Scenario: same context with or without a removed tier key

- **WHEN** `bdk ctx skill design` runs with and without `features.code-review-graph: true` in `.bdk/settings.yaml`
- **THEN** both outputs are byte-identical

### Requirement: Settings read through the kernel

Every settings read of the plugin SHALL go through the kernel, and the plugin SHALL NOT read or ship `.bdk/settings.json` readers, a hand-written settings schema or a Python bridge to the kernel.

A skill receives settings-derived content (rule sets, language rules, fragments, tool entries) only through `bdk ctx skill <name>` in its context lines (`kernel-cli`, Output modes). `setup` runs `bdk config` commands directly. `setup` writes `.bdk/settings.yaml` with the modeline (`kernel-settings`, Settings JSON Schema).

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `scripts/get_settings.py`, `scripts/kernel_settings.py`, `scripts/inject.py`, `scripts/inject-rules.py`, `scripts/inject-language-rules.py`, and no `hooks/check-bdk-config/`, `hooks/is-skill-exist/` or `hooks/check-rules-drift/` directory

#### Scenario: no reader of the v2 file

- **WHEN** `git grep -n "settings.json"` runs over `skills/`, `agents/`, `scripts/` and `hooks/`
- **THEN** it finds no code that opens `.bdk/settings.json`; prose that names it only as the v2 file converted by `bdk import` is allowed

#### Scenario: tool list in a skill

- **WHEN** a project's `.bdk/settings.yaml` declares a `tools.test` item and the skill `debug` loads
- **THEN** the rendered skill holds that item, including its `when` text, in the `Project commands: test` section of its BDK context

#### Scenario: rule override through a prompt value

- **WHEN** `.bdk/prompts/rules/security.md` has `mode: replace` and a skill whose manifest entry lists `rules/security` loads
- **THEN** its `Rules: security` section holds that file's content instead of the plugin's `rules/security.md`

### Requirement: Settings check at session start

The SessionStart hook SHALL run `bdk hooks session-start`, which prints STARTUP and, in a BDK project, the configuration check and v2 layout detection as content, without blocking the session.

`hooks/hooks.json` has exactly one SessionStart command, `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks session-start 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`, and no Stop hook (T02 decision Q-6: the rule-drift check is not ported). No hook command in `hooks/hooks.json` or in skill frontmatter runs `python3`. The output shapes are in `kernel-cli/hooks`, `bdk hooks session-start`.

#### Scenario: project still sets a removed key

- **WHEN** `.bdk/settings.yaml` sets `features.serena: true` and a session starts
- **THEN** the hook exits 0, no `decision: block` is emitted, and the session context holds the STARTUP text followed by a `[BDK] config:` line naming `features.serena`

#### Scenario: known keys stay silent

- **WHEN** `.bdk/settings.yaml` sets only registered keys, carries the modeline and no v2 marker exists
- **THEN** the hook prints the STARTUP text and no problem line

#### Scenario: not a BDK project

- **WHEN** a session starts in a directory without `.bdk/`
- **THEN** the hook prints the STARTUP text only and exits 0

#### Scenario: hooks file

- **WHEN** `hooks/hooks.json` is inspected
- **THEN** it has one `SessionStart` command matching the shape above, no `Stop` entry, and no command containing `python3`

#### Scenario: kernel unavailable at session start

- **WHEN** a session starts on a machine without `node` on `PATH`
- **THEN** the hook exits 0 and the session context ends with the `BDK STOP: kernel unavailable` line

## ADDED Requirements

### Requirement: Skill context lines

Every skill that needs prompt context SHALL receive it through exactly one pair of context lines (`kernel-cli`, Output modes, Context lines of a skill). A content test SHALL enforce the pair, so that a later change of the line form is made in one spec block and every skill that no longer matches fails.

The test (in the kernel's contract suite) reads every `skills/*/SKILL.md` and checks:

- a skill whose body mentions `ctx skill` has, as its first two non-empty body lines, a line matching the `content-wrapper` regex and a line matching the `content-fallback` regex, both naming the skill's directory name;
- no other line of the skill calls the kernel through a `!` block, and no line runs `inject.py`, `inject-rules.py`, `inject-language-rules.py` or `cat` in a `!` block;
- the set of skills with context lines equals the set of entries in the `ctx skill` manifest, and every part of every entry resolves (a declared prompt key with a plugin default, a `tools` group, an existing plugin file).

The regexes are read from the `kernel-cli` spec, not copied into the test. `skill-check` keeps enforcing the wrapper form and the `allowed-tools` pair (`skill-content-checks`).

#### Scenario: a skill without the fallback sentence

- **WHEN** a skill carries the wrapper line for `ctx skill debug` but not the fallback sentence
- **THEN** the content test fails and names the skill and the missing line

#### Scenario: a line names another skill

- **WHEN** `skills/design/SKILL.md` carries the context lines for `ctx skill create-plan`
- **THEN** the content test fails and names both skills

#### Scenario: manifest and skills disagree

- **WHEN** the manifest has an entry for a skill whose `SKILL.md` has no context lines, or a skill has context lines and no manifest entry
- **THEN** the content test fails and names the skill

#### Scenario: form change is found everywhere

- **WHEN** the `content-fallback` regex in `kernel-cli` changes and the skills are not updated
- **THEN** the content test fails once for every skill with context lines
