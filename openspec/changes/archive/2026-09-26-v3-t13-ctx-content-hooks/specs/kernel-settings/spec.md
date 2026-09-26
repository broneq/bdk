# Spec Delta

## MODIFIED Requirements

### Requirement: Prompt values

Markdown configuration values SHALL be files, one per prompt key, resolved across the same four layers, each layer contributing by `mode: extends` (appended to the value below) or `mode: replace` (discarding it).

A prompt key is the file path relative to a prompts directory without `.md` (`rules/security`), so it never contains a dot; its first segment is never `dir` or `files`. Each layer has one prompts directory, set only by `prompts.dir` in that layer's own file and never inherited; a relative `prompts.dir` resolves against the project root for the project and local layers and against the global layer's directory for the global layer. In the same layer, `prompts.files.<key>` wins over `<dir>/<key>.md`; its string form is a path with `mode: extends`, its object form carries `path`, `mode` and `applies`. A file's optional frontmatter carries `mode` and `applies` (a list of globs); for a file mapped by `prompts.files`, a frontmatter `mode` or `applies` that differs from the YAML entry answers `policy/config-invalid`. The default layer is the plugin file the prompt key declares, when it has one. Prompt keys are registered like YAML keys, as literal keys or as one-segment patterns: a prompts directory file or a `prompts.files` entry whose key is not registered answers `policy/unknown-config-key`. `applies` is validated as a list of globs and passed to the consumer, which interprets it; `ctx` selects rule sets by file and ignores `applies` until T31.

| Prompt key                    | Default file (plugin)                    | Owner | Consumer | v2 origin                 |
| ----------------------------- | ---------------------------------------- | ----- | -------- | ------------------------- |
| `rules/code-quality`          | `rules/code-quality.md`                  | T12   | `ctx`    | `quality.code-quality`    |
| `rules/architecture`          | `rules/architecture.md`                  | T12   | `ctx`    | `quality.architecture`    |
| `rules/design-patterns`       | `rules/design-patterns.md`               | T12   | `ctx`    | `quality.design-patterns` |
| `rules/security`              | `rules/security.md`                      | T12   | `ctx`    | `quality.security`        |
| `rules/engineering-judgment`  | `rules/engineering-judgment.md`          | T12   | `ctx`    | none                      |
| `rules/test-quality`          | `rules/test-quality.md`                  | T12   | `ctx`    | none                      |
| `rules/languages/*`           | `rules/languages/<name>.md` when shipped | T12   | `ctx`    | `language-rules.<name>`   |
| `fragments/decision/lavish`   | `fragments/decision/lavish.md`           | T13   | `ctx`    | none                      |
| `fragments/decision/ask-user` | `fragments/decision/ask-user.md`         | T13   | `ctx`    | none                      |

Later tasks add prompt keys through a delta (the Change kind templates in T21).

#### Scenario: extends then replace

- **WHEN** the plugin default of `rules/security` exists, the project layer has `.bdk/prompts/rules/security.md` with `mode: extends` and the local layer has `.bdk/prompts.local/rules/security.md` with `mode: replace`
- **THEN** the resolved value of `rules/security` is the local file alone, and `bdk config show prompts.rules/security --json` lists only the local file with mode `replace`

#### Scenario: file mapped from anywhere

- **WHEN** `.bdk/settings.yaml` sets `prompts.files.rules/security: docs/security-rules.md` and that file has no frontmatter
- **THEN** the project contribution to `rules/security` is `docs/security-rules.md` with `mode: extends`

#### Scenario: custom directory

- **WHEN** `.bdk/settings.yaml` sets `prompts.dir: docs/bdk-prompts` and `docs/bdk-prompts/rules/architecture.md` exists
- **THEN** that file is the project contribution to `rules/architecture` and `.bdk/prompts/` is not read

#### Scenario: unknown prompt file

- **WHEN** `.bdk/prompts/rules/secrity.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `rules/secrity` and the project layer

#### Scenario: project replaces a fragment

- **WHEN** `.bdk/prompts/fragments/decision/ask-user.md` has `mode: replace`
- **THEN** the resolved value of `fragments/decision/ask-user` is that file alone, and `bdk config show prompts.fragments/decision/ask-user --json` lists only that file
