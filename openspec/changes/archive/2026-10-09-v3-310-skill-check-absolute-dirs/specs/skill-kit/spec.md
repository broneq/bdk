# Spec Delta

## MODIFIED Requirements

### Requirement: Targets and configuration

The config SHALL declare targets. Each target SHALL have a kind, a list of directories, a profile and a name:

- a directory is resolved against the config root, so a relative directory is relative to the config file and an absolute one is used as written; config validation and discovery resolve it the same way;
- kind `skills` scans `<dir>/<name>/SKILL.md`, matching the file name in any letter case so that `skill-file-name` can report a wrong case;
- a subdirectory of a `skills` dir that is itself a `skills` dir of any target is a container of skills, not a skill directory, so the outer scan skips it;
- kind `agents` scans `<dir>/*.md`;
- the profile is `claude-code` (the default) or `portable`;
- the name defaults to the first directory;
- a target MAY set `plugin` (`true`, the default, or `false`): whether its skills or agents ship in a Claude Code plugin. Agents read it in `fields` and `field-values`; skills read it in `name-format`.

The config SHALL also declare the plugins to load, per-rule settings, per-target setting overrides and an optional baseline path. A rule setting SHALL be `off`, `warning`, `error` or `[severity, options]`; options merge over the rule's defaults. The config SHALL be loaded as a module whose default export comes from `defineConfig`, so a TypeScript config type-checks against the kit's declarations. A plugin SHALL be a value from `definePlugin({ name, rules })` with a kebab-case name, and its rule IDs SHALL be `<plugin name>/<rule>`. `defineRule` SHALL type a rule's options. An `agents` target with the `portable` profile SHALL be a configuration error.

#### Scenario: plugin rule IDs are namespaced

- **WHEN** a plugin named `acme` contributes a rule `no-todo` and that rule fails
- **THEN** the finding's rule ID is `acme/no-todo`

#### Scenario: severity override

- **WHEN** the config sets a rule to `off`
- **THEN** that rule reports nothing and `--list-rules` no longer lists it

#### Scenario: nested skills dir

- **WHEN** a config declares `dirs: ["skills", "skills/roles"]` and `skills/roles/` holds `lead/SKILL.md` and no `SKILL.md` of its own
- **THEN** `skills/roles/lead/SKILL.md` is checked and no `skill-file-name` finding names `skills/roles`

#### Scenario: portable agents target

- **WHEN** the config declares an `agents` target with the `portable` profile
- **THEN** the exit code is 2 and stderr says the portable profile has no agents

#### Scenario: plugin on a skills target

- **WHEN** the config declares a `skills` target with `plugin: false`
- **THEN** the target resolves with `plugin` false and every document of that target sees it on `doc.target`

#### Scenario: absolute target directory

- **WHEN** a config outside the project declares a `skills` target whose `dirs` entry is an absolute path to a skills directory
- **THEN** `skill-check --config <that file>` checks the skills in that directory and prints its findings, with no stack trace
