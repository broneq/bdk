# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Release with its own tests

Every kit release SHALL be a tag, cut by release-please from Conventional Commits, whose commit passed the kit's CI. release-please SHALL bump `package.json` and `.claude-plugin/plugin.json` together. The CLI SHALL read its version from `package.json` at run time, so a version bump needs no rebuild of `dist/`. The kit's CI SHALL run: build, the bundle diff, lint, format check, typecheck, the unused code check, unit tests with coverage thresholds of 90% lines, functions and statements and 85% branches, the fixture suite of every generic rule, and `skill-check` over the kit's own `skills/` with the kit's config. It SHALL run on Node 22.18, 24 and 26.

#### Scenario: a generic rule without a fixture

- **WHEN** a generic rule is added to the catalogue without a seeded-violation fixture
- **THEN** the kit's fixture suite fails

#### Scenario: the kit checks itself

- **WHEN** a kit skill fails a generic rule
- **THEN** the kit's CI fails at the self-check step

### Requirement: Rule API

A rule SHALL declare an ID, the target kinds it applies to, a default severity (`off`, `warning` or `error`) and optional default options, and SHALL implement `check`, `checkProject` or both.

- `check(doc, ctx)` SHALL run once per document of a matching kind, with the settings of the document's target. A document SHALL expose its kind, target, path, directory, text, lines, parsed frontmatter or the parse error, the line of each frontmatter key, the first body line, a code-fence test per line and, for a skill, the files of its directory.
- `checkProject(docs, ctx)` SHALL run once over every document of a matching kind in all targets, with the global settings, and SHALL receive the skill directories that hold Markdown but no skill file.
- A rule MAY implement `validateOptions(options)`, returning a problem or `undefined`. The config loader SHALL call it with the merged options of every target whose kind the rule applies to when the rule has `check` and is enabled for that target, and with the global settings when the rule has `checkProject` and is enabled globally. A problem SHALL be a configuration error (exit 2) whose message names the rule, the target when there is one, and the problem.
- A report SHALL carry a message and MAY carry a line, a file, the matched text for the fingerprint and `severity: "warning"`, which caps that finding at warning.

#### Scenario: a report capped at warning

- **WHEN** a rule set to `error` reports with `severity: "warning"`
- **THEN** the finding's severity is `warning`

#### Scenario: a rule enabled without an option it needs

- **WHEN** the config sets `block-allowed-tools` to `error` without the option `require`
- **THEN** the exit code is 2 and stderr names `block-allowed-tools`, the target and the missing option

#### Scenario: a rule that is off is not validated

- **WHEN** a rule with `validateOptions` is off for every target
- **THEN** its options are not validated and the config loads

### Requirement: Generic rule catalogue

The kit SHALL provide these rules with these default severities. Every rule SHALL have a seeded-violation fixture in the kit that fails that rule and no other.

| ID                         | Kinds          | Rule                                                                                                                                                                                                                                                                 | Default        |
| -------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `frontmatter`              | skills, agents | The file opens with a closed `---` block that parses as a YAML map.                                                                                                                                                                                                  | error          |
| `name-format`              | skills, agents | `name` is present, 1-64 characters and matches `^[a-z0-9]+(-[a-z0-9]+)*$`. The option `prefix` requires a prefix.                                                                                                                                                    | error          |
| `name-matches-dir`         | skills         | `name` equals the skill directory name.                                                                                                                                                                                                                              | error          |
| `skill-file-name`          | skills         | A skill directory holds `SKILL.md` with that exact case. A directory that holds Markdown but no skill file is reported too.                                                                                                                                          | error          |
| `description`              | skills, agents | `description` is present and non-empty. Its length is within the option `max`, whose default is the profile's cap: 1,536 characters for `description` plus `when_to_use` in `claude-code`, and 1,024 characters for `description` in `portable`.                     | error          |
| `description-front-loaded` | skills         | The first sentence does not open with filler (`This skill`, `A skill`, `Skill for`, `Helps`, `Used to`). The description contains a trigger clause matching the option `trigger`, whose default is `\bUse (when\|for\|on\|if\|whenever)\b`, case-insensitive.        | warning        |
| `fields`                   | skills, agents | Every frontmatter key is admitted by the profile.                                                                                                                                                                                                                    | error          |
| `field-values`             | skills, agents | Field values have the documented type or enum (`effort`, `context`, `shell`, booleans, `compatibility` of at most 500 characters, `metadata` as a string map, agent `tools` and `disallowedTools` as tool patterns).                                                 | error          |
| `invocation`               | skills         | `disable-model-invocation: true` together with `user-invocable: false` is an error (unreachable skill). `agent` without `context: fork` is a warning.                                                                                                                | error, warning |
| `require-model`            | agents         | `model` is present.                                                                                                                                                                                                                                                  | off            |
| `body`                     | skills, agents | The body after the frontmatter is non-empty.                                                                                                                                                                                                                         | error          |
| `line-limit`               | skills         | `SKILL.md` has at most the option `max` lines (default 500).                                                                                                                                                                                                         | error          |
| `absolute-paths`           | skills, agents | No absolute filesystem path, home-relative path or drive letter. A path starting with a `${VAR}` substitution is allowed.                                                                                                                                            | error          |
| `model-names`              | skills, agents | The body names no model family or model ID from the option `names`. The frontmatter `model` value is exempt.                                                                                                                                                         | error          |
| `arguments-typo`           | skills, agents | No `$ARGUMENT` without the trailing `S`.                                                                                                                                                                                                                             | error          |
| `portable-syntax`          | skills         | In a skill of the portable profile: no `!` block in the body (inline at the start of a line or after whitespace, or a fence opened with ` ```! `, also inside other fences) and no `${CLAUDE_*}` substitution on any line. Skills of other profiles are not checked. | error          |
| `references`               | skills         | Every relative link, backticked relative path or `${CLAUDE_SKILL_DIR}/` path from `SKILL.md` into the skill directory resolves (error). A referenced file that links on to a further file of the skill that `SKILL.md` does not reference is a warning.              | error, warning |
| `unused-files`             | skills         | Every file in the skill directory is referenced from `SKILL.md` or from a file that `SKILL.md` references.                                                                                                                                                           | error          |
| `layout`                   | skills         | The top-level entries of a skill directory are in the option `allowed` (default: any).                                                                                                                                                                               | error          |
| `unique-names`             | skills         | Skill names are unique across all skills targets.                                                                                                                                                                                                                    | error          |
| `cli-front`                | skills         | See "CLI-fronting skills".                                                                                                                                                                                                                                           | error          |
| `block-form`               | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                          | off            |
| `block-allowed-tools`      | skills         | See "Project policy rules".                                                                                                                                                                                                                                          | off            |
| `forbidden-text`           | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                          | off            |
| `required-fields`          | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                          | off            |
| `body-shape`               | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                          | off            |
| `namespaced-refs`          | skills, agents | See "Project policy rules".                                                                                                                                                                                                                                          | off            |

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

#### Scenario: Claude Code syntax in a portable skill

- **WHEN** a skill of the portable profile names `${CLAUDE_PLUGIN_ROOT}` in its body
- **THEN** a `portable-syntax` error is reported at that line

#### Scenario: Claude Code syntax in a claude-code skill

- **WHEN** a skill of the `claude-code` profile holds a `!` block and `${CLAUDE_SKILL_DIR}`
- **THEN** `portable-syntax` reports nothing

### Requirement: Skills shipped by the kit

The kit's plugin SHALL ship two skills, both passing every generic rule with the kit's config.

- `skill-check` SHALL be checked in the `claude-code` profile, because it runs the plugin's bundled CLI through `${CLAUDE_PLUGIN_ROOT}`. It SHALL declare `metadata.fronts-cli: skill-check`, pre-approve `Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs *)` in `allowed-tools`, and pass `cli-front`.
- `skill-authoring` SHALL pass every generic rule in the portable profile on its own, SHALL be model-invocable, SHALL keep `SKILL.md` within 200 lines, and SHALL explain how to write a skill: frontmatter per profile, directory layout, references and progressive disclosure, size, process versus knowledge, the admission rule for knowledge skills, CLI-fronting skills, portability of reusable skills and agents, read-only agents, and the Claude Code features a skill can use (string substitutions, `!` blocks, subagent dispatch, skill-scoped hooks, sharing files within a plugin). Every guideline that a generic rule checks SHALL cite that rule's ID as a parenthesised list of backticked IDs, such as (`line-limit`) or (`fields`, `field-values`). The set of generic rule IDs cited in `skills/skill-authoring/` SHALL equal the set of generic rule IDs in the catalogue.

#### Scenario: a rule without guidance

- **WHEN** a generic rule is added to the catalogue and `skill-authoring` does not cite its ID
- **THEN** the kit's CI fails

#### Scenario: guidance citing a missing rule

- **WHEN** `skill-authoring` cites a rule ID that the catalogue does not contain
- **THEN** the kit's CI fails

#### Scenario: skill-authoring stays portable

- **WHEN** `skills/skill-authoring` is checked alone in a portable target
- **THEN** no finding is reported

### Requirement: Rule tester

The kit SHALL export `checkRule(rule, input)` from `bdk-skill-kit/testing`, so a plugin author can unit test one rule in process. `checkRule` SHALL resolve to the findings of that rule alone, in the CLI's report order, with each file path relative to the target directory.

- `input` SHALL carry `files`, a map of paths relative to one target directory to file contents, and MAY carry `kind` (`skills` by default), `profile` (`claude-code` by default) and `options`.
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

#### Scenario: the temporary directory is removed

- **WHEN** `checkRule` returns or the rule throws
- **THEN** the directory the files were written to no longer exists
