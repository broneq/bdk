## ADDED Requirements

### Requirement: setup keeps .bdk/ out of the project's tools

After the settings, `/bdk:setup` SHALL find the configuration of every tool of the project that reads Markdown, YAML or JSON, and every project script that lists files itself, using the ignore column of `references/stacks.md`, and SHALL skip a tool whose ignore list already covers `.bdk/`. It SHALL ask once, with one `AskUserQuestion` multi-select holding one option per file and the entry that file gets, and SHALL write only the accepted entries, each as the smallest edit to the tool's own ignore list. It SHALL then run the `command` of every `tools.lint` entry once, never a formatter's write mode, and report every path under `.bdk/` in their output. It SHALL commit exactly the files it edited, in a commit of their own, and SHALL still never edit a file under `.bdk/`. A declined exclusion SHALL be named in the closing report. `bdk doctor` does not check the exclusion.

The `allowed-tools` of `setup` SHALL include `Edit`, `Write`, `Bash(git add *)` and `Bash(git commit *)`.

#### Scenario: fixture with a markdownlint config

- **WHEN** `/bdk:setup` runs on the eval fixture, whose `.markdownlint-cli2.mjs` sets `globs: ['**/*.md']`, and the user accepts the proposed exclusion
- **THEN** `.markdownlint-cli2.mjs` names `.bdk/` in its `ignores`, and the last commit that touches it is the setup's own commit, which touches no file under `.bdk/`

#### Scenario: exclusion declined

- **WHEN** the user declines every proposed exclusion
- **THEN** no project file outside `.bdk/` and `.gitignore` changes, no commit is made, and the closing report names each declined tool

#### Scenario: the skill text

- **WHEN** the content test reads `skills/stages/setup/SKILL.md` and `references/stacks.md`
- **THEN** the skill has a section on keeping `.bdk/` out of the project's tools that names one multi-select question, the run of the `tools.lint` commands, paths under `.bdk/` and a commit of only the edited files; `stacks.md` has an ignore column naming `.markdownlint-cli2`, `.prettierignore`, `ignores` of `eslint.config` and `extend-exclude` of `ruff`; and `allowed-tools` holds `Edit`, `Write`, `Bash(git add *)` and `Bash(git commit *)`
