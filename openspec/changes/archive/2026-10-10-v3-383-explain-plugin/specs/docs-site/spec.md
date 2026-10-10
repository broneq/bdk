# Spec Delta

## MODIFIED Requirements

### Requirement: The Reference is generated from the plugin sources
The Reference section SHALL hold one section per plugin under `plugins/` (`bdk`, `bdk-craft`, `bdk-explain`, `bdk-skill-kit`, `git-identity`). Its pages SHALL be generated from the plugin sources by one repository command and committed: each skill from its `SKILL.md` frontmatter (name, how it is invoked, arguments, description, and whether a user can invoke it), each agent from its frontmatter (name, description, model, tools), each hook from the plugin's `hooks.json` (event, matcher, what it runs), each `bdk` command from its declaration (the same usage, arguments, flags and exit codes `bdk <group> <verb> --help` prints), each settings key from the settings schema (key, type, default, description, and the examples the schema gives), with each top-level section of the settings page shown whole in one YAML block (the schema's example laid over every key's default, a comment per key, and the default of a key the example changes), and each rule of the BDK rule pack from its rule file (id, title, kind, stages, file globs, language pack, text). A Reference page SHALL NOT be edited by hand; it SHALL say so in a comment at its top. The generator SHALL fail and name the item when a source item lacks the field its entry needs.

#### Scenario: Skill entry
- **WHEN** a reader opens the Reference section of the `bdk` plugin
- **THEN** it holds an entry for `/bdk:plan` with its argument hint and the description from `plugins/bdk/skills/plan/SKILL.md`

#### Scenario: Internal skill
- **WHEN** a skill's frontmatter sets `user-invocable: false`
- **THEN** its Reference entry marks it as started by other skills, not by the user

#### Scenario: Rule catalogue
- **WHEN** a reader opens the rules page of the `bdk` Reference
- **THEN** it lists every rule of `plugins/bdk/rules/` with the id a `rules` entry of the settings takes, its title, stages and file globs

#### Scenario: Settings key without a description
- **WHEN** a contributor adds a key to the settings schema without a description and runs the generator
- **THEN** the generator fails and names the key

#### Scenario: Plugin with a single page
- **WHEN** a reader opens the Reference section of the `bdk-explain` plugin
- **THEN** it holds an entry for `/bdk-explain:explain` with the description from `plugins/bdk-explain/skills/explain/SKILL.md`
