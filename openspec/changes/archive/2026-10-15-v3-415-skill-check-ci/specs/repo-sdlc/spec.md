## ADDED Requirements

### Requirement: Every plugin's skills and agents pass skill-check
The `check` job SHALL run `skill-check` of `bdk-skill-kit` in strict mode, with the root `skill-check.config.ts`, over the `skills/` and `agents/` directories of every plugin under `plugins/`, and SHALL fail when it reports any error or warning. A plugin directory added under `plugins/` SHALL be checked without a change to the config.

#### Scenario: Error in a skill
- **WHEN** a pull request adds a `SKILL.md` under `plugins/<name>/skills/` whose body names an absolute path such as `/tmp/x.json`
- **THEN** the `check` job fails at the test step and its log names that file, line and the rule `absolute-paths`

#### Scenario: Warning in an agent-started skill
- **WHEN** a pull request adds a skill under `plugins/bdk/skills/` whose description has no trigger clause
- **THEN** the `check` job fails at the test step and its log names the rule `description-front-loaded`

#### Scenario: New plugin
- **WHEN** a pull request adds `plugins/<new>/skills/<skill>/SKILL.md` and changes no config
- **THEN** `skill-check` checks that skill

#### Scenario: Clean repository
- **WHEN** every skill and agent of every plugin passes every enabled rule
- **THEN** `skill-check` exits 0 with no finding and the test passes
