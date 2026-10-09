# bdk-cli/rules Specification

## Purpose

The `bdk rules` command group: `bdk rules for` selects the rules a role of a stage reads for a set of files, from the BDK rule pack and the project rules (spec `rule-pack`), and prints them ready for the role's prompt. The orchestrator decides which role gets them.

## Requirements

### Requirement: Rules for a stage and files

`bdk rules for --stage <stage> [--files <file>]...` SHALL print the rules selected from the BDK pack, as adjusted by the `BDK-` entries of `rules`, and the project rules of `rules` in the resolved configuration of the project around the working directory (spec `rule-pack`), writing nothing. `--stage` SHALL be required and one of `design`, `plan`, `execute`, `review`. A rule SHALL be selected when all of these hold:

- it is enabled;
- it is a project rule, or a pack rule of no language pack, or a pack rule of a language pack that `languages` lists;
- `stages` holds the stage;
- no file is given, or at least one given file matches one of its `paths`.

`--files` SHALL be repeatable, one path per occurrence. A file SHALL be matched as a path relative to the project root: a relative path is resolved against the working directory first, and a leading `./` is dropped. A glob's `*` SHALL NOT cross `/`, `**` SHALL match any number of directories, and dot files SHALL match like any other file. Without files the path condition SHALL be dropped, for a role whose work has no file set yet (a design, or a plan before it is cut into parts). A file that resolves outside the project root SHALL stay in the result and give a warning, since no rule path matches it. A language that `languages` lists and no pack rule belongs to SHALL give no warning.

#### Scenario: Selection by stage

- **WHEN** `bdk rules for --stage design` runs in a project with no languages and no `rules` entries
- **THEN** the result holds exactly the pack rules whose `stages` hold `design`, and none of a language pack

#### Scenario: Selection by path

- **WHEN** `languages` is `[typescript, react]` and `bdk rules for --stage review --files src/util.ts` runs
- **THEN** the result holds the TypeScript rules and the rules with `paths: ["**"]` of stage `review`, and no React rule, since `src/util.ts` matches no `**/*.jsx` or `**/*.tsx` glob

#### Scenario: Selection by language

- **WHEN** `languages` is `[typescript]` and `bdk rules for --stage review --files src/App.tsx` runs
- **THEN** the TypeScript rules are selected and the React rules are not, although `src/App.tsx` matches their paths

#### Scenario: Language without rules

- **WHEN** `languages` lists `python` and no pack rule belongs to a `python` language pack
- **THEN** the result holds no warning about `python`, and the exit code is 0

#### Scenario: Plan rules of the pack

- **WHEN** `languages` is `[typescript, react]` and `bdk rules for --stage plan` runs with no `rules` entries
- **THEN** the result holds exactly `BDK-ARCH-3`, `BDK-ARCH-4` and `BDK-CQ-1`

### Requirement: Rules output

The result SHALL hold the stage, the files as matched (root-relative, in the given order without repeats), the selected rules ordered by origin (`bdk`, then `global`, `project`, `local`) and then by id with numbers compared by value (`BDK-REACT-2` before `BDK-REACT-10`), and the warnings. Each rule SHALL carry `id`, `origin`, `kind`, `language` (the language pack or `null`), `file`, `paths`, `stages`, `source` and `verified` (`null` for a `house` rule), `matched` (the given files it matched, empty without files) and `text`. `origin` SHALL be `bdk` for a pack rule, adjusted or not, and for a project rule the layer whose entry sets its `text` or `file`. `file` SHALL be the pack rule's path for a pack rule, the path a project rule's `file` names, or the layer file of the entry that sets its `text`. The text form SHALL be Markdown a skill can put into a prompt unchanged: one heading line, then per rule a `## <id>` heading, one line naming the kind and the files it applies to, and the rule text. Warnings SHALL be listed after the rules under a `warnings:` line. An empty selection SHALL exit 0.

#### Scenario: JSON result

- **WHEN** `bdk rules for --stage review --files src/a.ts --json` runs in a configured project
- **THEN** stdout is one JSON document valid against the command's output schema, holding `stage` `review`, `files` `["src/a.ts"]`, the selected rules and `warnings`, and the exit code is 0

#### Scenario: Text form for a prompt

- **WHEN** `bdk rules for --stage review --files src/a.ts` selects `BDK-CQ-1`
- **THEN** stdout holds `## BDK-CQ-1`, a line naming `house` and `src/a.ts`, and the text of `BDK-CQ-1`

#### Scenario: Origin of a rule set in two layers

- **WHEN** the project layer declares `rules: {API-1: {text: "..."}}` and the local layer declares `rules: {API-1: {paths: ["src/api/**"]}}`
- **THEN** `API-1` has origin `project`, `file` `.bdk/settings.yaml` and `paths` `["src/api/**"]`

### Requirement: Rules errors

The command SHALL report, as environment errors with exit 3: `env/not-configured` when the project is not configured (spec `bdk-cli/config`, "Configured project"), with the hint to run `/bdk:setup`; `env/config-invalid` when the configuration has problems, with the hint to run `bdk config check`; `env/no-rule-pack` when the plugin's rule pack directory is missing, with the hint to reinstall the plugin; and `env/invalid-rule` when a pack rule file is invalid, cannot be read, or repeats the id of another pack rule, naming the file and the problem, or when the `file` of an enabled project rule is missing, cannot be read, or holds no text after its frontmatter, naming the key `rules.<id>.file`, the path and the problem. A missing or unknown `--stage` SHALL be the usage error `usage/invalid-argument` naming the stages.

#### Scenario: Not configured

- **WHEN** `bdk rules for --stage review` runs in a directory without `.bdk/settings.yaml`
- **THEN** the CLI reports `env/not-configured` with a hint naming `/bdk:setup` and exits 3

#### Scenario: Invalid project rule

- **WHEN** `.bdk/settings.yaml` declares `rules: {X-1: {text: "...", stages: [deploy]}}`
- **THEN** the CLI reports `env/config-invalid` with a hint naming `bdk config check`, and exits 3

#### Scenario: Two project rules with one id

- **WHEN** the `rules` map of `.bdk/settings.yaml` holds the key `API-1` twice
- **THEN** the CLI reports `env/config-invalid`, since the file is not valid YAML, and exits 3

#### Scenario: Missing rule file

- **WHEN** `.bdk/settings.yaml` declares `rules: {API-2: {file: docs/missing.md}}` and `docs/missing.md` does not exist
- **THEN** the CLI reports `env/invalid-rule` naming `rules.API-2.file` and `docs/missing.md`, and exits 3

#### Scenario: Unknown stage

- **WHEN** `bdk rules for --stage deploy` runs
- **THEN** the CLI reports `usage/invalid-argument` naming `deploy` and the four stages, and exits 2
