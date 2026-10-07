# rule-pack Specification

## Purpose

Defines the rules BDK hands to the roles of a Change: the rule file format, the BDK rule pack shipped in the `bdk` plugin, language packs, project rules, switching rules off, and the admission rule that keeps only rules with a measured effect (design section "Rules").

## Requirements

### Requirement: Rule file

A rule SHALL be one Markdown file whose name, without `.md`, is the rule's id, and whose content is a YAML frontmatter block followed by the rule text. The id SHALL consist of letters, digits and `-`, starting with a letter or digit. The frontmatter SHALL hold:

| Field      | Value                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `kind`     | `house` (a choice among valid alternatives) or `knowledge` (a fact about a library, language or tool)   |
| `paths`    | non-empty list of globs, relative to the project root, of the files the rule governs; `**` is every file |
| `stages`   | non-empty list of distinct stages among `design`, `plan`, `execute`, `review` that read the rule         |
| `source`   | `knowledge` only, required: where the fact is documented                                                 |
| `verified` | `knowledge` only, required: the date (`YYYY-MM-DD`) the fact was last checked                            |
| `measured` | optional: `report` (repository path), `bullet` and `class` of the measurement that admits the rule       |

Any other field, a missing required field, a value of the wrong type or an empty rule text SHALL make the file invalid. A file named `README.md` SHALL NOT be a rule.

#### Scenario: Valid house rule

- **WHEN** `rules/code-quality/BDK-CQ-1.md` holds `kind: house`, `paths: ["**"]`, `stages: [plan, execute, review]` and a rule text
- **THEN** it is the rule `BDK-CQ-1`

#### Scenario: Knowledge rule without source

- **WHEN** a rule file holds `kind: knowledge` and no `source`
- **THEN** the file is invalid and the problem names the file and `source`

### Requirement: BDK pack and language packs

The BDK rule pack SHALL live in `plugins/bdk/rules/`, read from the installed plugin. A rule under `rules/languages/<name>/` SHALL belong to the language pack `<name>`; every other rule SHALL belong to no language pack. Every id in the pack SHALL start with `BDK-` and be unique. The pack SHALL ship language packs `javascript`, `typescript` and `react`, whose rules' `paths` are the files of that language.

#### Scenario: Pack is valid

- **WHEN** the workspace tests read every rule file under `plugins/bdk/rules/`
- **THEN** each one is valid, every id starts with `BDK-`, and no id repeats

### Requirement: Admission by measurement

A rule SHALL be in the BDK pack only while a measurement shows that it changes the outcome. Every pack rule SHALL name its measurement in `measured`: a report in this repository, the bullet id it measured, and its class, which SHALL be `effective` (a review with the rule in the prompt found the seeded violation measurably more often than without it) or `corrects the model` (a model answered the rule's question against it). The report SHALL hold a row for that bullet with that class.

#### Scenario: Measurement on record

- **WHEN** the workspace tests read the `measured` field of every pack rule
- **THEN** each names a report that exists, and the report holds a row whose first cell is the bullet and whose class is the named class

#### Scenario: Unmeasured rule

- **WHEN** a rule file without `measured` is added under `plugins/bdk/rules/`
- **THEN** the workspace tests fail naming the file

### Requirement: Project rules

A project SHALL add its own rules as rule files under `.bdk/rules/` of the project root, in any subdirectory, with the same format and the same language pack convention (`.bdk/rules/languages/<name>/`). A project rule's id SHALL NOT start with `BDK-`, so it never collides with a pack rule, and SHALL be unique among the project rules.

#### Scenario: Project rule selected beside the pack

- **WHEN** `.bdk/rules/api/API-1.md` holds a valid rule for stage `review` and paths `src/api/**`, and `bdk rules for --stage review --files src/api/users.ts` runs
- **THEN** `API-1` is selected with origin `project`, next to the selected pack rules

#### Scenario: Project rule with a pack id

- **WHEN** `.bdk/rules/BDK-CQ-1.md` exists
- **THEN** reading the rules fails with `env/invalid-rule`, naming the file and the reserved prefix

### Requirement: Switching rules off

`rules.disabled` of the resolved configuration SHALL name rule ids, of either origin, that no role reads. An id in `rules.disabled` that names no rule SHALL give a warning naming it and the closest known id, and SHALL NOT be an error.

#### Scenario: Disabled pack rule

- **WHEN** `rules.disabled` is `[BDK-CQ-4]` and `bdk rules for --stage review --files src/a.ts` runs
- **THEN** `BDK-CQ-4` is not selected

#### Scenario: Unknown id

- **WHEN** `rules.disabled` is `[BDK-CQ-44]`
- **THEN** the result holds a warning naming `BDK-CQ-44` and suggesting `BDK-CQ-4`, and the exit code is 0
