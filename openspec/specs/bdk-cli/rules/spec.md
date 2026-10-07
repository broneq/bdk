# bdk-cli/rules Specification

## Purpose

The `bdk rules` command group: `bdk rules for` selects the rules a role of a stage reads for a set of files, from the BDK rule pack and the project rules (spec `rule-pack`), and prints them ready for the role's prompt. The orchestrator decides which role gets them.

## Requirements

### Requirement: Rules for a stage and files

`bdk rules for --stage <stage> [--files <file>]...` SHALL print the rules selected from the BDK pack and the project rules of the configured project around the working directory, writing nothing. `--stage` SHALL be required and one of `design`, `plan`, `execute`, `review`. A rule SHALL be selected when all of these hold:

- its id is not in `rules.disabled`;
- it belongs to no language pack, or to a language pack that `languages` lists;
- `stages` holds the stage;
- no file is given, or at least one given file matches one of its `paths`.

`--files` SHALL be repeatable, one path per occurrence. A file SHALL be matched as a path relative to the project root: a relative path is resolved against the working directory first, and a leading `./` is dropped. A glob's `*` SHALL NOT cross `/`, `**` SHALL match any number of directories, and dot files SHALL match like any other file. Without files the path condition SHALL be dropped, for a role whose work has no file set yet (a design). A file that resolves outside the project root SHALL stay in the result and give a warning, since no rule path matches it.

#### Scenario: Selection by stage

- **WHEN** `bdk rules for --stage design` runs in a project with no languages
- **THEN** the result holds exactly the rules whose `stages` hold `design`, and none of a language pack

#### Scenario: Selection by path

- **WHEN** `languages` is `[typescript, react]` and `bdk rules for --stage review --files src/util.ts` runs
- **THEN** the result holds the TypeScript rules and the rules with `paths: ["**"]` of stage `review`, and no React rule, since `src/util.ts` matches no `**/*.jsx` or `**/*.tsx` glob

#### Scenario: Selection by language

- **WHEN** `languages` is `[typescript]` and `bdk rules for --stage review --files src/App.tsx` runs
- **THEN** the TypeScript rules are selected and the React rules are not, although `src/App.tsx` matches their paths

#### Scenario: Language without rules

- **WHEN** `languages` lists `cobol` and no pack or project rule lives under a `languages/cobol/` directory
- **THEN** the result holds a warning that no rules exist for language `cobol`, and the exit code is 0

### Requirement: Rules output

The result SHALL hold the stage, the files as matched (root-relative, in the given order without repeats), the selected rules ordered by origin (`bdk` before `project`) and then by id with numbers compared by value (`BDK-REACT-2` before `BDK-REACT-10`), and the warnings. Each rule SHALL carry `id`, `origin`, `kind`, `language` (the language pack or `null`), `file` (its path), `paths`, `stages`, `source` and `verified` (`null` for a `house` rule), `matched` (the given files it matched, empty without files) and `text`. The text form SHALL be Markdown a skill can put into a prompt unchanged: one heading line, then per rule a `## <id>` heading, one line naming the kind and the files it applies to, and the rule text. Warnings SHALL be listed after the rules under a `warnings:` line. An empty selection SHALL exit 0.

#### Scenario: JSON result

- **WHEN** `bdk rules for --stage review --files src/a.ts --json` runs in a configured project
- **THEN** stdout is one JSON document valid against the command's output schema, holding `stage` `review`, `files` `["src/a.ts"]`, the selected rules and `warnings`, and the exit code is 0

#### Scenario: Text form for a prompt

- **WHEN** `bdk rules for --stage review --files src/a.ts` selects `BDK-CQ-1`
- **THEN** stdout holds `## BDK-CQ-1`, a line naming `house` and `src/a.ts`, and the text of `BDK-CQ-1`

### Requirement: Rules errors

The command SHALL report, as environment errors with exit 3: `env/not-configured` when the project is not configured (spec `bdk-cli/config`, "Configured project"), with the hint to run `/bdk:setup`; `env/config-invalid` when the configuration has problems, with the hint to run `bdk config check`; `env/no-rule-pack` when the plugin's rule pack directory is missing, with the hint to reinstall the plugin; and `env/invalid-rule` when a pack or project rule file is invalid, cannot be read, or repeats the id of another rule of its origin, naming the file and the problem. A missing or unknown `--stage` SHALL be the usage error `usage/invalid-argument` naming the stages.

#### Scenario: Not configured

- **WHEN** `bdk rules for --stage review` runs in a directory without `.bdk/settings.yaml`
- **THEN** the CLI reports `env/not-configured` with a hint naming `/bdk:setup` and exits 3

#### Scenario: Invalid project rule

- **WHEN** `.bdk/rules/X-1.md` has `stages: [deploy]`
- **THEN** the CLI reports `env/invalid-rule` naming `.bdk/rules/X-1.md` and `stages`, and exits 3

#### Scenario: Two project rules with one id

- **WHEN** `.bdk/rules/a/API-1.md` and `.bdk/rules/b/API-1.md` are both valid
- **THEN** the CLI reports `env/invalid-rule` naming both files, and exits 3

#### Scenario: Unknown stage

- **WHEN** `bdk rules for --stage deploy` runs
- **THEN** the CLI reports `usage/invalid-argument` naming `deploy` and the four stages, and exits 2
