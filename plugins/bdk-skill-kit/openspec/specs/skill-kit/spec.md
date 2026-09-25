# skill-kit Specification

## Purpose

Defines `bdk-skill-kit`, a Claude Code plugin listed in the BDK marketplace. It covers the deterministic `skill-check` validator for Agent Skills directories and Claude Code agent files (its CLI, configuration, plugin API, rule catalogue, profiles, baseline and output), the two skills the plugin ships, and how the kit is released. The contract holds for any consumer; rules that only one consumer needs live in that consumer's plugin and spec (BDK's `bdk/*` rules are specified in BDK's `skill-content-checks` spec).

## Requirements

### Requirement: Distribution

The kit SHALL live in the repository `broneq/bdk-skill-kit`, and the repository SHALL be a Claude Code plugin. The CLI and the library SHALL be committed as bundled ES modules (`dist/skill-check.mjs`, `dist/index.mjs` with `dist/index.d.ts`, `dist/testing.mjs` with `dist/testing.d.ts`) that import only `node:` modules. A consumer SHALL be able to install a release as a git-tag dependency and run `skill-check` without a build or install script, so `package.json` SHALL declare no lifecycle script that runs on install. The kit's skills SHALL invoke the CLI as `node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs`, and the plugin SHALL NOT have a `bin/` directory. The kit SHALL require Node 22.18 or newer, so that a TypeScript config or plugin loads without a build step.

#### Scenario: install by tag

- **WHEN** a project adds `github:broneq/bdk-skill-kit#v0.1.0` as a devDependency and installs with a frozen lockfile
- **THEN** `skill-check --help` runs, and no lifecycle script of the kit ran during installation

#### Scenario: committed bundle is the build

- **WHEN** the kit's CI builds the sources
- **THEN** `git diff --exit-code dist/` passes

#### Scenario: bundles import only Node built-ins

- **WHEN** the kit's tests inspect `dist/skill-check.mjs`, `dist/index.mjs` and `dist/testing.mjs`
- **THEN** every import specifier starts with `node:`, and `dist/index.d.ts` imports no other file

### Requirement: Release with its own tests

Every kit release SHALL be a tag, cut by release-please from Conventional Commits, whose commit passed the kit's CI. release-please SHALL bump `package.json` and `.claude-plugin/plugin.json` together. The CLI SHALL read its version from `package.json` at run time, so a version bump needs no rebuild of `dist/`. The kit's CI SHALL run: build, the bundle diff, lint, format check, typecheck, the unused code check, unit tests with coverage thresholds of 90% lines, functions and statements and 85% branches, the fixture suite of every generic rule, and `skill-check --portable` over the kit's own `skills/`. It SHALL run on Node 22.18, 24 and 26.

#### Scenario: a generic rule without a fixture

- **WHEN** a generic rule is added to the catalogue without a seeded-violation fixture
- **THEN** the kit's fixture suite fails

#### Scenario: the kit checks itself

- **WHEN** a kit skill uses a field outside the portable profile
- **THEN** the kit's CI fails at the self-check step

### Requirement: Invocation and exit codes

`skill-check [paths...] [--config <file>] [--portable] [--json] [--strict] [--baseline <file>] [--baseline-init] [--baseline-prune]` SHALL load the config (`skill-check.config.ts`, `.mjs` or `.js` in the working directory unless `--config` is given), check every target, and exit with one of three codes:

- 0 when no error-severity finding remains after the baseline;
- 1 when an error-severity finding remains, when a baseline entry is stale, or, under `--strict`, when a warning remains;
- 2 on a usage or configuration error, with the reason on stderr as `skill-check: <reason>` and no findings printed.

Path arguments narrow per-file rules to those skill directories or agent files. Project rules always see every target. `--list-rules` SHALL print the rule IDs that the config enables for at least one target, `--version` the kit version, and `--help` the usage text, which is the only usage reference.

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
- kind `agents` scans `<dir>/*.md`;
- the profile is `claude-code` (the default) or `portable`;
- the name defaults to the first directory.

The config SHALL also declare the plugins to load, per-rule settings, per-target setting overrides and an optional baseline path. A rule setting SHALL be `off`, `warning`, `error` or `[severity, options]`; options merge over the rule's defaults. The config SHALL be loaded as a module whose default export comes from `defineConfig`, so a TypeScript config type-checks against the kit's declarations. A plugin SHALL be a value from `definePlugin({ name, rules })` with a kebab-case name, and its rule IDs SHALL be `<plugin name>/<rule>`. `defineRule` SHALL type a rule's options. An `agents` target with the `portable` profile SHALL be a configuration error.

#### Scenario: plugin rule IDs are namespaced

- **WHEN** a plugin named `bdk` contributes a rule `wrapper-form` and that rule fails
- **THEN** the finding's rule ID is `bdk/wrapper-form`

#### Scenario: severity override

- **WHEN** the config sets a rule to `off`
- **THEN** that rule reports nothing and `--list-rules` no longer lists it

#### Scenario: portable agents target

- **WHEN** the config declares an `agents` target with the `portable` profile
- **THEN** the exit code is 2 and stderr says the portable profile has no agents

### Requirement: Rule API

A rule SHALL declare an ID, the target kinds it applies to, a default severity (`off`, `warning` or `error`) and optional default options, and SHALL implement `check`, `checkProject` or both.

- `check(doc, ctx)` SHALL run once per document of a matching kind, with the settings of the document's target. A document SHALL expose its kind, target, path, directory, text, lines, parsed frontmatter or the parse error, the line of each frontmatter key, the first body line, a code-fence test per line and, for a skill, the files of its directory.
- `checkProject(docs, ctx)` SHALL run once over every document of a matching kind in all targets, with the global settings, and SHALL receive the skill directories that hold Markdown but no skill file.
- A report SHALL carry a message and MAY carry a line, a file, the matched text for the fingerprint and `severity: "warning"`, which caps that finding at warning.

#### Scenario: a report capped at warning

- **WHEN** a rule set to `error` reports with `severity: "warning"`
- **THEN** the finding's severity is `warning`

### Requirement: Profiles

The `portable` profile SHALL admit only the six Agent Skills standard fields: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.

The `claude-code` profile SHALL admit these fields:

- for skills, the six standard fields plus the Claude Code skill fields `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`;
- for agents, the Claude Code subagent fields `name`, `description`, `tools`, `disallowedTools`, `model`, `maxTurns`, `skills`, `memory`, `background`, `omitClaudeMd`, `effort`, `isolation`, `color`, `initialPrompt`, `experimental`.

The agent fields `hooks`, `mcpServers` and `permissionMode` SHALL be reported with the reason that plugin agents ignore them. `--portable` SHALL apply the portable profile to every skills target. The field lists SHALL live in one source file that records the date and the URLs they were read from.

#### Scenario: portable rejects a Claude-only field

- **WHEN** `skill-check --portable` runs over a skill whose frontmatter sets `disable-model-invocation`
- **THEN** a `fields` error names the field and the portable profile, and the exit code is 1

#### Scenario: current host fields are accepted

- **WHEN** a skill in the `claude-code` profile sets `when_to_use` and `arguments`
- **THEN** no `fields` finding is reported

#### Scenario: plugin-ignored agent field

- **WHEN** an agent file sets `permissionMode`
- **THEN** a `fields` error states that plugin agents ignore the field

#### Scenario: misspelled field

- **WHEN** a skill sets `disable-model-invokation`
- **THEN** a `fields` error names the unknown key

### Requirement: Generic rule catalogue

The kit SHALL provide these rules with these default severities. Every rule SHALL have a seeded-violation fixture in the kit that fails that rule and no other.

| ID                         | Kinds          | Rule                                                                                                                                                                                                                                                          | Default        |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `frontmatter`              | skills, agents | The file opens with a closed `---` block that parses as a YAML map.                                                                                                                                                                                           | error          |
| `name-format`              | skills, agents | `name` is present, 1-64 characters and matches `^[a-z0-9]+(-[a-z0-9]+)*$`. The option `prefix` requires a prefix.                                                                                                                                             | error          |
| `name-matches-dir`         | skills         | `name` equals the skill directory name.                                                                                                                                                                                                                       | error          |
| `skill-file-name`          | skills         | A skill directory holds `SKILL.md` with that exact case. A directory that holds Markdown but no skill file is reported too.                                                                                                                                   | error          |
| `description`              | skills, agents | `description` is present and non-empty. Its length is within the option `max`, whose default is the profile's cap: 1,536 characters for `description` plus `when_to_use` in `claude-code`, and 1,024 characters for `description` in `portable`.              | error          |
| `description-front-loaded` | skills         | The first sentence does not open with filler (`This skill`, `A skill`, `Skill for`, `Helps`, `Used to`). The description contains a trigger clause matching the option `trigger`, whose default is `\bUse (when\|for\|on\|if\|whenever)\b`, case-insensitive. | warning        |
| `fields`                   | skills, agents | Every frontmatter key is admitted by the profile.                                                                                                                                                                                                             | error          |
| `field-values`             | skills, agents | Field values have the documented type or enum (`effort`, `context`, `shell`, booleans, `compatibility` of at most 500 characters, `metadata` as a string map, agent `tools` and `disallowedTools` as tool patterns).                                          | error          |
| `invocation`               | skills         | `disable-model-invocation: true` together with `user-invocable: false` is an error (unreachable skill). `agent` without `context: fork` is a warning.                                                                                                         | error, warning |
| `require-model`            | agents         | `model` is present.                                                                                                                                                                                                                                           | off            |
| `body`                     | skills, agents | The body after the frontmatter is non-empty.                                                                                                                                                                                                                  | error          |
| `line-limit`               | skills         | `SKILL.md` has at most the option `max` lines (default 500).                                                                                                                                                                                                  | error          |
| `absolute-paths`           | skills, agents | No absolute filesystem path, home-relative path or drive letter. A path starting with a `${VAR}` substitution is allowed.                                                                                                                                     | error          |
| `model-names`              | skills, agents | The body names no model family or model ID from the option `names`. The frontmatter `model` value is exempt.                                                                                                                                                  | error          |
| `arguments-typo`           | skills, agents | No `$ARGUMENT` without the trailing `S`.                                                                                                                                                                                                                      | error          |
| `references`               | skills         | Every relative link, backticked relative path or `${CLAUDE_SKILL_DIR}/` path from `SKILL.md` into the skill directory resolves (error). A referenced file that links on to a further file of the skill that `SKILL.md` does not reference is a warning.       | error, warning |
| `unused-files`             | skills         | Every file in the skill directory is referenced from `SKILL.md` or from a file that `SKILL.md` references.                                                                                                                                                    | error          |
| `layout`                   | skills         | The top-level entries of a skill directory are in the option `allowed` (default: any).                                                                                                                                                                        | error          |
| `unique-names`             | skills         | Skill names are unique across all skills targets.                                                                                                                                                                                                             | error          |
| `cli-front`                | skills         | See "CLI-fronting skills".                                                                                                                                                                                                                                    | error          |

A backticked path counts for `references` only outside code fences and only when its first segment is `references`, `scripts`, `assets`, `examples`, `templates` or an existing top-level entry of the skill. Links to URLs, anchors, absolute paths and `../` paths are not checked.

#### Scenario: name does not match its directory

- **WHEN** `skills/review/SKILL.md` declares `name: code-review`
- **THEN** a `name-matches-dir` error is reported for that file

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

#### Scenario: duplicate names across directories

- **WHEN** two skills targets each hold a skill named `review`
- **THEN** a `unique-names` error names both directories

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

### Requirement: Skills shipped by the kit

The kit's plugin SHALL ship two skills, both in the portable profile and both passing every generic rule.

- `skill-check` SHALL declare `metadata.fronts-cli: skill-check`, pre-approve `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs *)` in `allowed-tools`, and pass `cli-front`.
- `skill-authoring` SHALL be model-invocable, SHALL keep `SKILL.md` within 200 lines, and SHALL explain how to write a skill: frontmatter per profile, directory layout, references and progressive disclosure, size, process versus knowledge, the admission rule for knowledge skills, and CLI-fronting skills. Every guideline that a generic rule checks SHALL cite that rule's ID as a parenthesised list of backticked IDs, such as (`line-limit`) or (`fields`, `field-values`). The set of generic rule IDs cited in `skills/skill-authoring/` SHALL equal the set of generic rule IDs in the catalogue.

#### Scenario: a rule without guidance

- **WHEN** a generic rule is added to the catalogue and `skill-authoring` does not cite its ID
- **THEN** the kit's CI fails

#### Scenario: guidance citing a missing rule

- **WHEN** `skill-authoring` cites a rule ID that the catalogue does not contain
- **THEN** the kit's CI fails

### Requirement: Rule tester

The kit SHALL export `checkRule(rule, input)` from `bdk-skill-kit/testing`, so a plugin author can unit test one rule in process. `checkRule` SHALL resolve to the findings of that rule alone, in the CLI's report order, with each file path relative to the target directory.

- `input` SHALL carry `files`, a map of paths relative to one target directory to file contents, and MAY carry `kind` (`skills` by default), `profile` (`claude-code` by default) and `options`.
- It SHALL discover, parse and check the files with the same code the CLI uses, and SHALL merge `options` over the rule's default options as a config setting does.
- It SHALL run `check` for each document of a matching kind and `checkProject` once, and SHALL run the rule even when its default severity is `off`, at `error`; otherwise at the rule's default severity. A report with `severity: "warning"` SHALL stay capped at warning.
- It SHALL reject a target that the config loader rejects, such as a portable agents target, and a `files` path that is absolute or leaves the target directory.
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

#### Scenario: the temporary directory is removed

- **WHEN** `checkRule` returns or the rule throws
- **THEN** the directory the files were written to no longer exists
