## MODIFIED Requirements

### Requirement: Settings read through the kernel

Every settings read of the plugin SHALL go through the kernel, and the plugin SHALL NOT read or ship `.bdk/settings.json` readers, a hand-written settings schema or a Python bridge to the kernel.

A skill receives settings-derived content (rule sets, language rules, fragments, tool entries) only through `bdk ctx skill <name>` in its context lines (`kernel-cli`, Output modes). `setup` runs `bdk config` commands directly. `setup` writes `.bdk/settings.yaml` with the modeline (`kernel-settings`, Settings JSON Schema).

#### Scenario: plugin tree

- **WHEN** the plugin tree is inspected
- **THEN** it has no `scripts/get_settings.py`, `scripts/kernel_settings.py`, `scripts/inject.py`, `scripts/inject-rules.py`, `scripts/inject-language-rules.py`, and no `hooks/check-bdk-config/`, `hooks/is-skill-exist/` or `hooks/check-rules-drift/` directory

#### Scenario: no reader of the v2 file

- **WHEN** `git grep -n "settings.json"` runs over `skills/`, `agents/`, `scripts/` and `hooks/`
- **THEN** it finds no code that opens `.bdk/settings.json`; prose that names it only as the v2 file migrated by `/bdk:setup` is allowed

#### Scenario: tool list in a skill

- **WHEN** a project's `.bdk/settings.yaml` declares a `tools.test` item and the skill `debug` loads
- **THEN** the rendered skill holds that item, including its `when` text, in the `Project commands: test` section of its BDK context

#### Scenario: rule override through a prompt value

- **WHEN** `.bdk/prompts/rules/security.md` has `mode: replace` and a skill whose manifest entry lists `rules/security` loads
- **THEN** its `Rules: security` section holds that file's content instead of the plugin's `rules/security.md`
