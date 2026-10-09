# skill-kit Specification

## Purpose

Defines `bdk-skill-kit`, a Claude Code plugin listed in the BDK marketplace. It covers the deterministic `skill-check` validator for Agent Skills directories and Claude Code agent files (its CLI, configuration, plugin API, rule catalogue, profiles, baseline and output), the skill the plugin ships, and how the kit is released. The contract holds for any consumer: a project's own choices reach the generic rules as options, and a rule that no option can express lives in that consumer's plugin and spec.

## Requirements

### Requirement: Distribution from the BDK repository

The kit SHALL live in the repository `broneq/bdk` under `plugins/bdk-skill-kit/`, and that directory SHALL be a Claude Code plugin. The CLI and the library SHALL be bundled ES modules (`dist/skill-check.mjs`, `dist/index.mjs` with `dist/index.d.ts`, `dist/testing.mjs` with `dist/testing.d.ts`) that import only `node:` modules, built by the kit's `build` script. `dist/` SHALL NOT be committed; the release job SHALL build it and publish it with the rest of the plugin, `package.json` included, to the `release` branch. A consumer SHALL be able to install a release as a git dependency on a commit of the `release` branch with the path `plugins/bdk-skill-kit` and run `skill-check` without a build or install script, so `package.json` SHALL declare no lifecycle script that runs on install. The kit's skills SHALL invoke the CLI as `node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs`, and the plugin SHALL NOT have a `bin/` directory. The kit SHALL require Node 22.18 or newer, so that a TypeScript config or plugin loads without a build step.

#### Scenario: install from the release branch

- **WHEN** a project adds `github:broneq/bdk#<release-commit>&path:/plugins/bdk-skill-kit` as a devDependency and installs with a frozen lockfile
- **THEN** `skill-check --help` runs, and no lifecycle script of the kit ran during installation

#### Scenario: no committed bundle

- **WHEN** a contributor runs `git ls-files plugins/bdk-skill-kit/dist`
- **THEN** the output is empty

#### Scenario: bundles import only Node built-ins

- **WHEN** the kit's tests inspect `dist/skill-check.mjs`, `dist/index.mjs` and `dist/testing.mjs`
- **THEN** every import specifier starts with `node:`, and `dist/index.d.ts` imports no other file

### Requirement: Release with its own tests

Every kit release SHALL be a tag `bdk-skill-kit--v<version>`, cut by release-please from Conventional Commits on `main` of `broneq/bdk`, whose commit passed the pull request CI. release-please SHALL bump `version` in `.claude-plugin/plugin.json`, the kit's only version; `package.json` SHALL carry no version. The CLI SHALL read its version from `.claude-plugin/plugin.json` at run time. The pull request CI SHALL run over the kit: lint, format check, typecheck, unit tests with coverage thresholds of 90% lines, functions and statements and 85% branches, the fixture suite of every generic rule, `skill-check` over the kit's own `skills/` with the kit's config, and the build. It SHALL run on the Node version of the repository's `.nvmrc`.

#### Scenario: a generic rule without a fixture

- **WHEN** a generic rule is added to the catalogue without a seeded-violation fixture
- **THEN** the kit's fixture suite fails, and with it the `check` job at the test step

#### Scenario: the kit checks itself

- **WHEN** a kit skill fails a generic rule
- **THEN** the kit's self-check test fails, and with it the `check` job at the test step

#### Scenario: version from the plugin manifest

- **WHEN** `version` in `plugins/bdk-skill-kit/.claude-plugin/plugin.json` reads `0.4.0`
- **THEN** `skill-check --version` prints `0.4.0`, from the sources and from the built bundle

#### Scenario: coverage below the threshold

- **WHEN** a change leaves the kit's sources below 90% line coverage
- **THEN** `pnpm test` fails and names the threshold

### Requirement: Invocation and exit codes

`skill-check [paths...] [--config <file>] [--portable] [--json] [--strict] [--baseline <file>] [--baseline-init] [--baseline-prune]` SHALL load the config (`skill-check.config.ts`, `.mjs` or `.js` in the working directory unless `--config` is given), check every target, and exit with one of four codes:

- 0 when no error-severity finding remains after the baseline;
- 1 when an error-severity finding remains, when a baseline entry is stale, or, under `--strict`, when a warning remains;
- 2 on a usage or configuration error, with the reason on stderr as `skill-check: <reason>` and no findings printed;
- 3 on any other error (an internal error: discovery, a rule or the checker itself failed), with one line on stderr as `skill-check: internal error: <message>` and no findings printed. When a rule threw, the message SHALL name the rule ID and the file it was checking (or say it was a project check). The stack trace SHALL NOT be printed unless the environment variable `SKILL_CHECK_DEBUG` is set to a non-empty value; then it SHALL follow that line on stderr.

Path arguments narrow per-file rules to those skill directories or agent files. Project rules always see every target. `--list-rules` SHALL print the rule IDs that the config enables for at least one target, `--version` the kit version, and `--help` the usage text, which is the only usage reference and SHALL list every exit code and `SKILL_CHECK_DEBUG`.

`--explain <rule>` SHALL load the config, resolve the rule ID among the generic rules and the rules of the config's plugins, and print to stdout the rule's ID, the kinds it applies to and its default severity, then its explanation, and exit 0. An unknown rule ID SHALL be a usage error (exit 2) that names the ID. A rule without an explanation SHALL print the ID line and a line saying that the rule has no explanation.

#### Scenario: clean tree

- **WHEN** every target passes every enabled rule
- **THEN** the exit code is 0 and the output says no findings remain

#### Scenario: configuration error

- **WHEN** the config names an unknown rule ID, a target directory that does not exist, or a plugin that fails to load
- **THEN** the exit code is 2 and stderr names the offending entry

#### Scenario: strict mode

- **WHEN** only warnings remain and `--strict` is given
- **THEN** the exit code is 1

#### Scenario: path arguments narrow per-file rules only

- **WHEN** `skill-check skills/beta` runs on a tree with the skills `alpha` and `beta`
- **THEN** per-file rules report only on `skills/beta`, and project rules still see both skills

#### Scenario: explain a generic rule

- **WHEN** `skill-check --explain cli-front` runs in a project with a config
- **THEN** stdout opens with `cli-front`, its kinds and default severity, followed by the explanation, and the exit code is 0

#### Scenario: explain a plugin rule

- **WHEN** the config loads a plugin `acme` whose rule `no-todo` carries an explanation and `skill-check --explain acme/no-todo` runs
- **THEN** stdout holds that explanation and the exit code is 0

#### Scenario: explain an unknown rule

- **WHEN** `skill-check --explain nope` runs
- **THEN** the exit code is 2 and stderr names `nope`

#### Scenario: a rule throws

- **WHEN** the config loads a plugin whose rule `t/boom` throws a plain `Error("boom")` while checking `skills/alpha/SKILL.md`
- **THEN** the exit code is 3, stdout is empty, and stderr is the single line `skill-check: internal error: rule t/boom failed on skills/alpha/SKILL.md: boom` with no stack trace

#### Scenario: discovery fails

- **WHEN** discovery fails with an unexpected file system error
- **THEN** the exit code is 3, stderr is one `skill-check: internal error:` line holding the error's message, and no stack trace is printed

#### Scenario: stack trace on request

- **WHEN** a rule throws and `SKILL_CHECK_DEBUG=1` is set
- **THEN** the exit code is 3 and stderr holds the `skill-check: internal error:` line followed by the stack trace

#### Scenario: help lists every exit code

- **WHEN** `skill-check --help` runs
- **THEN** stdout lists the exit codes 0, 1, 2 and 3 and names `SKILL_CHECK_DEBUG`

### Requirement: Output formats

Every finding SHALL carry a rule ID, a severity (`error` or `warning`), a file path relative to the config root, a 1-based line, a message and a line-independent fingerprint.

- The default output SHALL print one line per finding as `file:line  severity  rule  message`, then a blank line and a summary line with the error, warning and file counts and, when the baseline suppressed findings, their count.
- When the environment variable `GITHUB_ACTIONS` is set, the default output SHALL also print one GitHub workflow annotation per finding.
- `--json` SHALL print a single JSON object `{ version, findings, baseline: { suppressed, stale }, summary: { files, errors, warnings } }` and nothing else on stdout.
- Findings SHALL be ordered by file, line, rule ID and message.

#### Scenario: JSON output

- **WHEN** `skill-check --json` finds one violation
- **THEN** stdout parses as one JSON object whose `findings` holds one entry with `rule`, `severity`, `file`, `line`, `message` and `fingerprint`

#### Scenario: annotations on GitHub Actions

- **WHEN** `GITHUB_ACTIONS=true` and a finding is reported without `--json`
- **THEN** the output contains an `::error file=<file>,line=<line>` annotation for it

### Requirement: Targets and configuration

The config SHALL declare targets. Each target SHALL have a kind, a list of directories, a profile and a name:

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

### Requirement: Rule API

A rule SHALL declare an ID, the target kinds it applies to, a default severity (`off`, `warning` or `error`) and optional default options, and SHALL implement `check`, `checkProject` or both. A rule MAY carry `explain`, a text that `--explain` prints.

- `check(doc, ctx)` SHALL run once per document of a matching kind, with the settings of the document's target. A document SHALL expose its kind, target, path, directory, text, lines, parsed frontmatter or the parse error, the line of each frontmatter key, the first body line, a code-fence test per line and, for a skill, the files of its directory. The target SHALL expose its kind, directories, profile, name and `plugin`. Inside a git work tree those files SHALL be the ones git tracks or would track, so files that `.gitignore`, `.git/info/exclude` or the global excludes file ignore are left out and untracked files that none of them ignore are kept; outside a git work tree they SHALL be every file on disk. Dotfiles are left out in both cases.
- `checkProject(docs, ctx)` SHALL run once over every document of a matching kind in all targets, with the global settings, and SHALL receive the skill directories that hold Markdown but no skill file.
- A rule MAY implement `validateOptions(options)`, returning a problem or `undefined`. The config loader SHALL call it with the merged options of every target whose kind the rule applies to when the rule has `check` and is enabled for that target, and with the global settings when the rule has `checkProject` and is enabled globally. A problem SHALL be a configuration error (exit 2) whose message names the rule, the target when there is one, and the problem.
- A report SHALL carry a message and MAY carry a line, a file, the matched text for the fingerprint and `severity: "warning"`, which caps that finding at warning.
- Every generic rule SHALL carry an explanation that says what the rule checks, why it matters and how to fix a finding, and that names each option the rule takes. The kit's tests SHALL fail when a generic rule has none.

#### Scenario: a report capped at warning

- **WHEN** a rule set to `error` reports with `severity: "warning"`
- **THEN** the finding's severity is `warning`

#### Scenario: a rule enabled without an option it needs

- **WHEN** the config sets `block-allowed-tools` to `error` without the option `require`
- **THEN** the exit code is 2 and stderr names `block-allowed-tools`, the target and the missing option

#### Scenario: a rule that is off is not validated

- **WHEN** a rule with `validateOptions` is off for every target
- **THEN** its options are not validated and the config loads

#### Scenario: a generic rule without an explanation

- **WHEN** a generic rule is added without `explain`
- **THEN** the kit's tests fail

### Requirement: Profiles

The `portable` profile SHALL admit only the six Agent Skills standard fields: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.

The `claude-code` profile SHALL admit these fields:

- for skills, the six standard fields plus the Claude Code skill fields `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`;
- for agents, the Claude Code subagent fields `name`, `description`, `tools`, `disallowedTools`, `model`, `maxTurns`, `skills`, `memory`, `background`, `omitClaudeMd`, `effort`, `isolation`, `color`, `experimental`, and, when the target sets `plugin: false`, `hooks`, `mcpServers`, `permissionMode` and `initialPrompt`.

On an agents target with `plugin: true`, the fields `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` SHALL be reported with the reason that plugin agents ignore them and that `plugin: false` admits them. On a target with `plugin: false`, `field-values` SHALL require `permissionMode` to be one of `default`, `manual`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `hooks` to be a map, `mcpServers` to be a list whose entries are strings or single-key maps, and `initialPrompt` to be a string. `--portable` SHALL apply the portable profile to every skills target. The field lists SHALL live in one source file that records the date and the URLs they were read from.

#### Scenario: portable rejects a Claude-only field

- **WHEN** `skill-check --portable` runs over a skill whose frontmatter sets `disable-model-invocation`
- **THEN** a `fields` error names the field and the portable profile, and the exit code is 1

#### Scenario: current host fields are accepted

- **WHEN** a skill in the `claude-code` profile sets `when_to_use` and `arguments`
- **THEN** no `fields` finding is reported

#### Scenario: plugin-ignored agent field

- **WHEN** an agent file on a target without `plugin` sets `permissionMode` or `initialPrompt`
- **THEN** a `fields` error per field states that plugin agents ignore it and names `plugin: false`

#### Scenario: non-plugin agent field

- **WHEN** an agent file on a target with `plugin: false` sets `permissionMode: plan`
- **THEN** no `fields` or `field-values` finding is reported

#### Scenario: non-plugin agent field with a bad value

- **WHEN** an agent file on a target with `plugin: false` sets `permissionMode: yolo`
- **THEN** a `field-values` error lists the accepted values

#### Scenario: misspelled field

- **WHEN** a skill sets `disable-model-invokation`
- **THEN** a `fields` error names the unknown key

### Requirement: Generic rule catalogue

The kit SHALL provide these rules with these default severities. Every rule SHALL have a seeded-violation fixture in the kit that fails that rule and no other.

| ID                         | Kinds          | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                       | Default        |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `frontmatter`              | skills, agents | The file opens with a closed `---` block that parses as a YAML map.                                                                                                                                                                                                                                                                                                                                                                        | error          |
| `name-format`              | skills, agents | `name` is present, 1-64 characters and matches `^[a-z0-9]+(-[a-z0-9]+)*$`. The option `prefix` requires a prefix. A skill `name` in the portable profile does not contain `anthropic` or `claude`; a skill `name` in the `claude-code` profile on a target with `plugin: false` is not `synced` or `anthropic-skills`. The explanation states that for agents the format is the kit's convention, not the host's.                          | error          |
| `name-matches-dir`         | skills         | `name` equals the skill directory name.                                                                                                                                                                                                                                                                                                                                                                                                    | error          |
| `skill-file-name`          | skills         | A skill directory holds `SKILL.md` with that exact case. A directory that holds Markdown but no skill file is reported too.                                                                                                                                                                                                                                                                                                                | error          |
| `description`              | skills, agents | `description` is present and non-empty. Its length is within the option `max`, whose default is the profile's cap: 1,536 characters for `description` plus `when_to_use` in `claude-code`, and 1,024 characters for `description` in `portable`. It holds no XML tag (`<tag>`, `</tag>` or `<tag/>`) outside backticks.                                                                                                                    | error          |
| `description-front-loaded` | skills         | The first sentence does not open with filler (`This skill`, `A skill`, `Skill for`, `Helps`, `Used to`) or with a first- or second-person opener (`I`, `I'll`, `I will`, `I can`, `We`, `You`). The description contains a trigger clause matching the option `trigger`, whose default is `\bUse (when\|for\|on\|if\|whenever)\b`, case-insensitive.                                                                                       | warning        |
| `fields`                   | skills, agents | Every frontmatter key is admitted by the profile and, for agents, by the target's `plugin` setting.                                                                                                                                                                                                                                                                                                                                        | error          |
| `field-values`             | skills, agents | Field values have the documented type or enum (`effort`, `context`, `shell`, `permissionMode`, booleans, `compatibility` of at most 500 characters, `metadata` as a string map, agent `tools` and `disallowedTools` as tool patterns, `hooks` as a map, `mcpServers` as a list).                                                                                                                                                           | error          |
| `invocation`               | skills         | `disable-model-invocation: true` together with `user-invocable: false` is an error (unreachable skill). `agent` without `context: fork` is a warning.                                                                                                                                                                                                                                                                                      | error, warning |
| `require-model`            | agents         | `model` is present.                                                                                                                                                                                                                                                                                                                                                                                                                        | off            |
| `body`                     | skills, agents | The body after the frontmatter is non-empty.                                                                                                                                                                                                                                                                                                                                                                                               | error          |
| `line-limit`               | skills         | `SKILL.md` has at most the option `max` lines (default 500).                                                                                                                                                                                                                                                                                                                                                                               | error          |
| `absolute-paths`           | skills, agents | No absolute filesystem path, home-relative path or drive letter. A path starting with a `${VAR}` substitution is allowed.                                                                                                                                                                                                                                                                                                                  | error          |
| `model-names`              | skills, agents | The body names no model family or model ID from the option `names`. The frontmatter `model` value is exempt.                                                                                                                                                                                                                                                                                                                               | error          |
| `reasoning-prompts`        | skills, agents | The body, `description` and `when_to_use` hold no phrase from the option `phrases` that asks the model to put its reasoning in the output. The default list is `think step by step`, `think step-by-step`, `show your reasoning`, `explain your reasoning`, `show your thinking`, `write out your thinking`, `reason out loud`, `chain of thought`, `<thinking>`, `<reasoning>`, `scratchpad`, compared case-insensitively on whole words. | warning        |
| `arguments-typo`           | skills, agents | No `$ARGUMENT` without the trailing `S`.                                                                                                                                                                                                                                                                                                                                                                                                   | error          |
| `portable-syntax`          | skills         | In a skill of the portable profile: no `!` block in the body (inline at the start of a line or after whitespace, or a fence opened with ` ```! `, also inside other fences) and no `${CLAUDE_*}` substitution on any line. Skills of other profiles are not checked.                                                                                                                                                                       | error          |
| `references`               | skills         | Every relative link, backticked relative path or `${CLAUDE_SKILL_DIR}/` path from `SKILL.md` into the skill directory resolves (error). A referenced file that links on to a further file of the skill that `SKILL.md` does not reference is a warning.                                                                                                                                                                                    | error, warning |
| `unused-files`             | skills         | Every file in the skill directory is referenced from `SKILL.md` or from a file that `SKILL.md` references.                                                                                                                                                                                                                                                                                                                                 | error          |
| `layout`                   | skills         | The top-level entries of a skill directory are in the option `allowed` (default: any).                                                                                                                                                                                                                                                                                                                                                     | error          |
| `unique-names`             | skills         | Skill names are unique across all skills targets.                                                                                                                                                                                                                                                                                                                                                                                          | error          |
| `cli-front`                | skills         | See "CLI-fronting skills".                                                                                                                                                                                                                                                                                                                                                                                                                 | error          |
| `block-form`               | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                                                                                                                                                                                                | off            |
| `block-allowed-tools`      | skills         | See "Project policy rules".                                                                                                                                                                                                                                                                                                                                                                                                                | off            |
| `forbidden-text`           | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                                                                                                                                                                                                | off            |
| `required-fields`          | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                                                                                                                                                                                                | off            |
| `body-shape`               | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                                                                                                                                                                                                | off            |
| `namespaced-refs`          | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                                                                                                                                                                                                | off            |

A backticked path counts for `references` only outside code fences and only when its first segment is `references`, `scripts`, `assets`, `examples`, `templates` or an existing top-level entry of the skill. Links to URLs, anchors, absolute paths and `../` paths are not checked.

#### Scenario: name does not match its directory

- **WHEN** `skills/review/SKILL.md` declares `name: code-review`
- **THEN** a `name-matches-dir` error is reported for that file

#### Scenario: reserved word in a portable name

- **WHEN** a skill of the portable profile declares `name: claude-helper`
- **THEN** a `name-format` error says the Skills API rejects the word `claude`

#### Scenario: reserved name in Claude Code

- **WHEN** a skill of the `claude-code` profile on a target with `plugin: false` declares `name: synced`
- **THEN** a `name-format` error says Claude Code does not load a skill outside a plugin at that name

#### Scenario: reserved name inside a plugin

- **WHEN** a skill of the `claude-code` profile on a target without `plugin` declares `name: synced`
- **THEN** `name-format` reports nothing

#### Scenario: XML tag in a description

- **WHEN** a skill's description reads `Reviews <file> for defects. Use when a review starts.`
- **THEN** a `description` error names the tag `<file>`

#### Scenario: first-person description

- **WHEN** a skill's description opens with `I review design documents.`
- **THEN** a `description-front-loaded` finding asks for the third person

#### Scenario: reasoning prompt in a body

- **WHEN** an agent body reads `Think step by step and show your reasoning before the verdict.`
- **THEN** one `reasoning-prompts` warning per matched phrase is reported at that line

#### Scenario: reasoning prompt in a description

- **WHEN** a skill's description reads `Reviews a diff. Use when a chain of thought is wanted.`
- **THEN** a `reasoning-prompts` warning is reported at the `description` line

#### Scenario: encouragement is not a reasoning prompt

- **WHEN** a skill body reads `Think through the edge cases.`
- **THEN** `reasoning-prompts` reports nothing

#### Scenario: line limit

- **WHEN** the config sets `line-limit` to 200 and a `SKILL.md` has 201 lines
- **THEN** a `line-limit` error is reported

#### Scenario: model name in prose

- **WHEN** a skill body mentions a model family name and its frontmatter sets `model`
- **THEN** one `model-names` error is reported, for the body line only

#### Scenario: broken reference

- **WHEN** `SKILL.md` links to `references/missing.md`, which does not exist
- **THEN** a `references` error names the link and its line

#### Scenario: reference two levels deep

- **WHEN** `SKILL.md` links `references/a.md`, which links `references/b.md`, and `SKILL.md` does not link `references/b.md`
- **THEN** a `references` warning is reported in `references/a.md` at the line of the link

#### Scenario: unreferenced file

- **WHEN** a skill directory holds `references/old.md` and no referenced file mentions it
- **THEN** an `unused-files` error names `references/old.md`

#### Scenario: ignored file

- **WHEN** a skill directory inside a git work tree holds `scripts/__pycache__/a.pyc` and `.gitignore` ignores `__pycache__/`
- **THEN** no rule reports `scripts/__pycache__/a.pyc`

#### Scenario: duplicate names across directories

- **WHEN** two skills targets each hold a skill named `review`
- **THEN** a `unique-names` error names both directories

#### Scenario: Claude Code syntax in a portable skill

- **WHEN** a skill of the portable profile names `${CLAUDE_PLUGIN_ROOT}` in its body
- **THEN** a `portable-syntax` error is reported at that line

#### Scenario: Claude Code syntax in a claude-code skill

- **WHEN** a skill of the `claude-code` profile holds a `!` block and `${CLAUDE_SKILL_DIR}`
- **THEN** `portable-syntax` reports nothing

### Requirement: CLI-fronting skills

A skill that declares `metadata.fronts-cli: <command>` SHALL be checked by `cli-front`. The rule fails the skill in any of these cases:

- the skill sets `disable-model-invocation: true`;
- its `SKILL.md` exceeds 30 lines;
- the body never mentions `<command>` together with `--help` on one line;
- it documents usage, which is either more than three distinct `--flag` tokens other than `--help` and `--json`, or more than two table or list rows that start with a flag or a subcommand of `<command>`.

The thresholds SHALL be the rule options `maxLines`, `maxFlags` and `maxUsageRows`.

#### Scenario: a CLI-fronting skill that duplicates usage

- **WHEN** a skill with `metadata.fronts-cli: bdk` lists five `bdk` flags in a table
- **THEN** a `cli-front` error states that usage belongs in `bdk --help`

#### Scenario: a compliant CLI-fronting skill

- **WHEN** a 20-line model-invocable skill with `metadata.fronts-cli: bdk` gives one invocation form and points at `bdk --help`
- **THEN** `cli-front` reports nothing

### Requirement: Baseline

A baseline SHALL be a JSON array of entries `{ rule, file, fingerprint }`, sorted, written with two-space indentation. The fingerprint SHALL be derived from the rule ID, the file path and the whitespace-normalised text that triggered the finding, and not from a line number. The baseline path SHALL come from `--baseline` (relative to the working directory) or from the config's `baseline` (relative to the config root). A run with a baseline SHALL follow these rules:

- each entry suppresses at most one matching finding, so identical findings need one entry each;
- every entry that matches no finding is reported as a `baseline-stale` error in the entry's file;
- a finding that has no entry is never suppressed;
- when path arguments narrow the run, entries for files outside those paths are never stale.

`--baseline-init` SHALL write a baseline from the current findings and SHALL refuse with exit 2 when the file exists or no baseline path is configured. `--baseline-prune` SHALL remove stale entries and SHALL NOT add any. Both SHALL refuse path arguments and each other with exit 2. A configured baseline that is missing or is not a valid array of entries SHALL be a configuration error.

#### Scenario: fixed violation left in the baseline

- **WHEN** a baselined violation is fixed and the baseline is unchanged
- **THEN** the run reports `baseline-stale` for that entry and exits 1

#### Scenario: new violation in a baselined file

- **WHEN** a file with baselined findings gains a new violation
- **THEN** the new finding is reported and the run exits 1

#### Scenario: edit above a baselined finding

- **WHEN** lines are inserted above a baselined violation without changing it
- **THEN** the finding stays suppressed

#### Scenario: prune never grows

- **WHEN** `--baseline-prune` runs on a tree with new violations
- **THEN** the baseline loses its stale entries and gains no entry, and the new violations are reported

#### Scenario: init refuses to overwrite

- **WHEN** `--baseline-init` runs and the baseline file exists
- **THEN** the exit code is 2 and the file is unchanged

### Requirement: Kit skill

The kit's plugin SHALL ship one skill, `skill-check`, passing every generic rule with the kit's config. It SHALL be checked in the `claude-code` profile, because it runs the plugin's bundled CLI through `${CLAUDE_PLUGIN_ROOT}`. It SHALL declare `metadata.fronts-cli: skill-check`, pre-approve `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs *)` in `allowed-tools`, pass `cli-front`, and tell the agent to run `--explain <rule>` on a finding and to run the checker after each iteration of a skill it is writing. The kit SHALL ship no prose of its own on how to write a skill: that is Anthropic's Agent Skills best practices and the `skill-creator` skill, and what a rule asks is its explanation.

#### Scenario: the kit ships one skill

- **WHEN** the kit's tests list `skills/`
- **THEN** the only entry is `skill-check`

#### Scenario: the kit checks itself

- **WHEN** `skill-check` fails a generic rule with the kit's config
- **THEN** the kit's self-check test fails, and with it the `check` job at the test step

### Requirement: Rule tester

The kit SHALL export `checkRule(rule, input)` from `bdk-skill-kit/testing`, so a plugin author can unit test one rule in process. `checkRule` SHALL resolve to the findings of that rule alone, in the CLI's report order, with each file path relative to the target directory.

- `input` SHALL carry `files`, a map of paths relative to one target directory to file contents, and MAY carry `kind` (`skills` by default), `profile` (`claude-code` by default), `plugin` (for agents, `true` by default) and `options`.
- It SHALL discover, parse and check the files with the same code the CLI uses, and SHALL merge `options` over the rule's default options as a config setting does.
- It SHALL run `check` for each document of a matching kind and `checkProject` once, and SHALL run the rule even when its default severity is `off`, at `error`; otherwise at the rule's default severity. A report with `severity: "warning"` SHALL stay capped at warning.
- It SHALL reject a target that the config loader rejects, such as a portable agents target, options that the rule's `validateOptions` rejects, and a `files` path that is absolute or leaves the target directory.
- It SHALL leave no files behind, also when the rule throws.
- The main entry `bdk-skill-kit` SHALL NOT load the tester, and the tester SHALL run on Node versions without TypeScript type stripping.

#### Scenario: a per-document rule

- **WHEN** a test calls `checkRule` with a rule that reports on every skill and `files` holding `plan/SKILL.md`
- **THEN** the result holds one finding with the rule's ID and the file `plan/SKILL.md`

#### Scenario: a project rule

- **WHEN** a test calls `checkRule` with a `checkProject` rule and two skills
- **THEN** the rule runs once and receives both documents

#### Scenario: options are merged over the defaults

- **WHEN** a rule has default options `{ a: 1, b: 2 }` and the test passes `options: { b: 3 }`
- **THEN** the rule sees `{ a: 1, b: 3 }`

#### Scenario: a rule that is off by default

- **WHEN** a test checks a rule whose default severity is `off`
- **THEN** the rule runs and its findings have severity `error`

#### Scenario: the portable profile

- **WHEN** a test passes `profile: "portable"`
- **THEN** each document's target has the portable profile

#### Scenario: a non-plugin agents target

- **WHEN** a test passes `kind: "agents"` and `plugin: false`
- **THEN** each document's target has `plugin` false

#### Scenario: the temporary directory is removed

- **WHEN** `checkRule` returns or the rule throws
- **THEN** the directory the files were written to no longer exists

### Requirement: Project policy rules

The kit SHALL provide six rules whose values are a project's choices. Each SHALL be off by default and SHALL validate its options, so enabling it without the options it needs, or with malformed ones, is a configuration error. A skill or agent is named by its frontmatter `name`, else by its skill directory or its agent file name without `.md`. A tool list field is read as a YAML list of strings, or as a string split on whitespace and commas outside parentheses. A `!` block is as defined for `portable-syntax`.

- `block-form` (skills, agents), option `patterns`: a list of regular expressions, default empty. Every body line that holds a `!` block SHALL match one of the patterns as a whole line; with no pattern, every block is reported. The fingerprint is built from the line text.
- `block-allowed-tools` (skills), option `require`: a non-empty list of `allowed-tools` entries. A skill whose body holds a `!` block SHALL list every entry, compared as exact strings, in its `allowed-tools`. One finding names the missing entries, at the `allowed-tools` key or line 1, with a fingerprint that does not depend on which entries are missing.
- `forbidden-text` (skills, agents), option `terms`: a non-empty list of `{ words, match?, where?, message, allow? }`. `match` is `word` (the default: the text is not preceded or followed by a word character or a hyphen) or `substring`; whitespace inside a word matches any run of whitespace. `where` is `anywhere` (the default, every line of the file) or `code` (backticked spans and fenced lines only). `allow` lists names the term does not apply to. One finding SHALL be reported per distinct matched text per term per line, with the message `` `<matched>`: <message> `` and a fingerprint built from the matched text and the line text.
- `required-fields` (skills, agents), option `entries`: a non-empty list of `{ names, field, equals?, includes?, reason? }` with at least one of `equals` and `includes`. For a document whose name is in `names` and whose frontmatter parses, the field SHALL deep-equal `equals`, and the field read as a tool list SHALL contain every entry of `includes`. A finding is reported at the field's key, else the `name` key, else line 1, appends `reason`, and has a fingerprint that does not depend on the missing entries.
- `body-shape` (skills, agents), options `maxLines`, `maxSentences` (positive integers) and `endsWith` (a non-empty string), at least one of them. The body's non-blank lines SHALL number at most `maxLines`, its sentence ends (`.`, `!` or `?` followed by whitespace or the end) at most `maxSentences`, and its last non-blank line SHALL end with `endsWith`. One finding at the first body line names every violated limit, with a fingerprint that does not depend on the counts.
- `namespaced-refs` (skills, agents, project rule), options `namespace` (a kebab-case plugin name, required) and `foreign` (`warning`, the default, or `off`). A `/name` token or a `subagent_type` value naming a skill or agent of any checked target without a namespace SHALL be an error asking for `/<namespace>:name` or `subagent_type: <namespace>:name`. A `/<other>:name` token with another namespace SHALL be a warning when `foreign` is `warning`. A `/` inside a path or URL (preceded by a word character, `.`, `/`, `:` or `-`, or followed by `/` or a file extension) is not a token.

#### Scenario: a block outside the allowed form

- **WHEN** `block-form` has the pattern of a CLI wrapper and a skill holds `` !`date` `` inside a code fence
- **THEN** a `block-form` error is reported at that line

#### Scenario: a block without its allowed-tools entries

- **WHEN** `block-allowed-tools` requires two entries and a skill with a `!` block lists one of them in a space-separated `allowed-tools` string
- **THEN** one error names the missing entry

#### Scenario: a code-only term in prose

- **WHEN** `forbidden-text` has the term `make` with `where: "code"` and a body line reads "Make sure" while another holds `` `make build` ``
- **THEN** one error is reported, at the line with the code span

#### Scenario: an exempt name

- **WHEN** a `forbidden-text` term allows `setup` and the skill `setup` uses the term
- **THEN** no finding is reported for that skill

#### Scenario: a gate without its field

- **WHEN** `required-fields` requires `disable-model-invocation: true` for `plan` and `plan/SKILL.md` does not set it
- **THEN** an error names `plan` and the field at the `name` line

#### Scenario: a body over its shape

- **WHEN** `body-shape` sets `maxSentences: 1` on an agents target and an agent body has two sentences
- **THEN** one error is reported at the first body line, and its fingerprint equals that of a body with three sentences

#### Scenario: a bare reference to the plugin's own skill

- **WHEN** `namespaced-refs` has the namespace `acme`, the targets hold the skill `plan`, and a body says "hand it to /plan"
- **THEN** an error asks for `/acme:plan`, and `docs/plan`, `/plan.md` and `https://x.dev/plan` are not reported
