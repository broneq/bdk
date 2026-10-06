# Spec Delta

## MODIFIED Requirements

### Requirement: Rule file frontmatter

A rule file `.bdk/rules/<ruleId>.md` SHALL carry the frontmatter below and the rule text as its body (R-rule-id, T5, T02 decision Q-5).

| Field      | Type                                                            | Req.                   | Meaning                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`   | integer                                                         | yes                    |                                                                                                                                                                                                 |
| `id`       | `[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[1-9][0-9]*`                  | yes                    | Equals the file name without `.md` (`API-4`, `BDK-SEC-2`); `BDK-` only in the bundle.                                                                                                           |
| `kind`     | `house \| knowledge`                                            | yes                    | `house`: a choice among valid alternatives; `knowledge`: a fact that corrects the model (T5, `rule-pack`, What a rule is).                                                                      |
| `paths`    | non-empty array of globs                                        | yes                    | The files the rule governs; `**` names every file. Matched against the target's files, or against the work tree files when the target has none (`kernel-cli/rules`, bdk rules show, Selection). |
| `stages`   | non-empty array of unique `design \| plan \| execute \| review` | yes                    | The pipeline stages whose readers get the rule (`kernel-cli/rules`, Stage readers); no wildcard.                                                                                                |
| `severity` | `critical \| high \| medium \| low`                             | yes                    |                                                                                                                                                                                                 |
| `origin`   | `bdk \| user \| <changeId>/<id>`                                | yes                    | The shipped pack, `rules accept` without `--from`, or the qualified entry or attempt finding the rule was adopted from.                                                                         |
| `evidence` | array of qualified ids                                          | no                     | Every `--from` ref of `rules accept`.                                                                                                                                                           |
| `since`    | date `yyyy-mm-dd`                                               | yes                    |                                                                                                                                                                                                 |
| `source`   | string                                                          | when `kind: knowledge` | Where the stated fact comes from (T5); unrelated to provenance `source`.                                                                                                                        |
| `verified` | date                                                            | when `kind: knowledge` |                                                                                                                                                                                                 |
| `removed`  | string                                                          | no                     | Tombstone reason; the id is never reused.                                                                                                                                                       |

Both `paths` and `stages` are stated in every rule: a rule is never global or read by every stage because a field was left out. A rule file that carries `applies` or `roles` fails validation naming the field, with no migration (v3 is unreleased).

The bundle's pack lives under `rules/` of the plugin with the same frontmatter and `origin: bdk` (`rule-pack`, Pack layout); `.bdk/rules/` holds the project's rules only. Two sessions that accept a rule with the same number in parallel create the same path; that add/add conflict is the permitted "same rule written two ways" conflict, and the later Change renumbers (numbers are never reused).

#### Scenario: knowledge rule without verification

- **WHEN** a rule has `kind: knowledge` and no `verified`
- **THEN** validation fails naming `verified`

#### Scenario: tombstone keeps its id

- **WHEN** `.bdk/rules/API-2.md` carries `removed: superseded by API-5`
- **THEN** it validates, and `rules check` counts it as a tombstone and never assigns the number 2 of `API` again

#### Scenario: adopted rule names its origin

- **WHEN** `rules accept` writes a rule with `--from 2026-09-25-passwordless-login/L-m2x9v7qa`
- **THEN** its `origin` is that ref and `evidence` lists it

#### Scenario: origin import is refused

- **WHEN** `.bdk/rules/API-1.md` carries `origin: import` and `bdk rules check` runs
- **THEN** validation fails naming `origin`, and the exit code is 2 with `rule: policy/rule-format`

#### Scenario: rule without stages

- **WHEN** `.bdk/rules/API-1.md` carries `paths: ["src/api/**"]` and no `stages`, and `bdk rules check` runs
- **THEN** validation fails naming `stages`, and the exit code is 2 with `rule: policy/rule-format`

#### Scenario: old field names are refused

- **WHEN** `.bdk/rules/API-1.md` carries `applies: ["src/api/**"]` or `roles: [reviewer]` and `bdk rules check` runs
- **THEN** validation fails naming `applies` or `roles`, and the exit code is 2 with `rule: policy/rule-format`

#### Scenario: a rule for every file and every stage

- **WHEN** a rule carries `paths: ["**"]` and `stages: [design, plan, execute, review]`
- **THEN** it validates, and `stages: ["*"]` or `stages: []` fails naming `stages`
