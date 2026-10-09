# rule-pack Specification

## Purpose

Defines the rules BDK hands to the roles of a Change: the rule file format, the BDK rule pack shipped in the `bdk` plugin, language packs, project rules, switching rules off, and the admission rule that keeps only rules with a measured effect (design section "Rules").

## Requirements

### Requirement: Rule file

A rule of the BDK pack SHALL be one Markdown file whose name, without `.md`, is the rule's id, and whose content is a YAML frontmatter block followed by the rule text. The id SHALL consist of letters, digits and `-`, starting with a letter or digit. The frontmatter SHALL hold:

| Field      | Value                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| `kind`     | `house` (a choice among valid alternatives) or `knowledge` (a fact about a library, language or tool)   |
| `paths`    | non-empty list of globs, relative to the project root, of the files the rule governs; `**` is every file |
| `stages`   | non-empty list of distinct stages among `design`, `plan`, `execute`, `review` that read the rule         |
| `source`   | `knowledge` only, required: where the fact is documented                                                 |
| `verified` | `knowledge` only, required: the date (`YYYY-MM-DD`) the fact was last checked                            |
| `measured` | optional: `report` (repository path), `bullet` and `class` of the measurement that admits the rule       |

Any other field, a missing required field, a value of the wrong type or an empty rule text SHALL make the file invalid. A file named `README.md` SHALL NOT be a rule. A project's own rules SHALL NOT be rule files: they are declared in the settings (requirement "Project rules").

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

A project SHALL declare its own rules in the configuration, as entries of the map `rules` keyed by the rule id, in any layer (spec `bdk-cli/config`, "Layer files"); entries of one id in several layers SHALL merge field by field, a higher layer winning. An entry whose id does not start with `BDK-` SHALL be a project rule with these fields:

| Field      | Value                                                                                                   | Default             |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------------------- |
| `text`     | the rule text, Markdown                                                                                 | exactly one of `text` and `file` |
| `file`     | path of a Markdown file holding the rule text; a leading `---` frontmatter block in it is not part of the text | exactly one of `text` and `file` |
| `kind`     | `house` or `knowledge`                                                                                  | `house`             |
| `paths`    | non-empty list of globs relative to the project root                                                    | `["**"]`            |
| `stages`   | non-empty list of distinct stages among `design`, `plan`, `execute`, `review`                           | `[execute, review]` |
| `source`   | `knowledge` only, required                                                                              | none                |
| `verified` | `knowledge` only, required, `YYYY-MM-DD`                                                                | none                |
| `enabled`  | boolean; `false` means no role reads the rule                                                           | `true`              |

A `file` in the `project` or `local` layer SHALL be resolved against the project root, and a `file` in the `global` layer against the directory of the global layer file. A project rule SHALL belong to no language pack: its `paths` select the files it governs. The directory `.bdk/rules/` SHALL NOT be read.

#### Scenario: Project rule selected beside the pack

- **WHEN** `.bdk/settings.yaml` declares `rules: {API-1: {paths: ["src/api/**"], text: "Parse the body with the schema."}}` and `bdk rules for --stage review --files src/api/users.ts` runs
- **THEN** `API-1` is selected with origin `project`, kind `house` and the text `Parse the body with the schema.`, next to the selected pack rules

#### Scenario: Rule text from a file

- **WHEN** `.bdk/settings.yaml` declares `rules: {GATEWAY-1: {stages: [design], file: docs/conventions/gateway.md}}` and that file starts with a `---` frontmatter block followed by `Register every endpoint in src/gateway/routes.ts.`
- **THEN** `bdk rules for --stage design` selects `GATEWAY-1` with the text `Register every endpoint in src/gateway/routes.ts.` and without the frontmatter

#### Scenario: Defaults of a minimal rule

- **WHEN** a project rule entry holds only `text`
- **THEN** it is a `house` rule for every file, selected for the stages `execute` and `review` and not for `design` or `plan`

#### Scenario: Personal rule in the global layer

- **WHEN** the global layer file `~/.config/bdk/settings.yaml` declares `rules: {ME-1: {file: me-1.md}}` and `~/.config/bdk/me-1.md` holds a text
- **THEN** `bdk rules for --stage execute` in any configured project selects `ME-1` with origin `global` and that text

#### Scenario: Project rule with a pack id

- **WHEN** `.bdk/settings.yaml` declares `rules: {BDK-CQ-1: {text: "Short names are fine."}}`
- **THEN** `bdk config check` reports `rules.BDK-CQ-1.text`, and `bdk rules for` reports `env/config-invalid`

#### Scenario: Rule directory not read

- **WHEN** `.bdk/rules/api/API-1.md` holds a valid rule file and no layer declares `API-1`
- **THEN** `bdk rules for --stage review --files src/api/users.ts` selects no rule `API-1` and reports no warning about the directory

### Requirement: Switching rules off

An entry `enabled: false` SHALL switch off the rule of its id, so no role reads it. An entry whose id starts with `BDK-` SHALL adjust the pack rule of that id and SHALL hold only `enabled`, `paths` and `stages`; `paths` and `stages` SHALL replace the pack rule's values, and its text, kind and language pack SHALL stay the pack's. A `BDK-` entry that names no pack rule SHALL give a warning naming it and the closest pack id, and SHALL NOT be an error.

#### Scenario: Disabled pack rule

- **WHEN** `rules` holds `BDK-CQ-4: {enabled: false}` and `bdk rules for --stage review --files src/a.ts` runs
- **THEN** `BDK-CQ-4` is not selected

#### Scenario: Local layer switches one rule off

- **WHEN** the project layer declares `rules: {BDK-DP-2: {enabled: false}, API-1: {text: "..."}}` and the local layer declares `rules: {BDK-CQ-4: {enabled: false}}`
- **THEN** `bdk rules for --stage review` selects neither `BDK-DP-2` nor `BDK-CQ-4`, and selects `API-1`

#### Scenario: Pack rule narrowed

- **WHEN** `languages` is `[react]`, `rules` holds `BDK-REACT-10: {paths: ["apps/web/**/*.tsx"]}`, and `bdk rules for --stage review --files packages/ui/Button.tsx --files apps/web/App.tsx` runs
- **THEN** `BDK-REACT-10` is selected with only `apps/web/App.tsx` matched, and its text is the pack's

#### Scenario: Unknown id

- **WHEN** `rules` holds `BDK-CQ-44: {enabled: false}`
- **THEN** the result of `bdk rules for` holds a warning naming `BDK-CQ-44` and suggesting `BDK-CQ-4`, and the exit code is 0
