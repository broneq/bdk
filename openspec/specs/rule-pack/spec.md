# rule-pack Specification

## Purpose

What a rule is in BDK, how the shipped `BDK-*` rule pack is laid out and admitted, the plan-quality rules `PL`, and the report that records how the v2 bullets were measured, pruned and numbered (T5, P7, S4).

## Requirements

### Requirement: What a rule is

A rule SHALL be a choice among valid alternatives that the project or BDK made and wants followed, stated as one instruction, and SHALL carry one of two kinds:

- `house`: the choice itself ("write paths go through command handlers; queries never mutate", "default to zero new comments").
- `knowledge`: a fact about a library, language or tool that a model gets wrong or does not know, kept only while it corrects the model; it carries `source` (where the fact comes from) and `verified` (the date it was last checked) (T5).

Not a rule, and never admitted as one: a fact about the project's own system ("users and permissions are joined by `user_id`"), which belongs in code, documentation or a living spec; a process lesson ("the negative test was forgotten"), which is a `learning` or `finding` entry for the audit; a principle every competent engineer applies with no alternative being rejected; and knowledge both measured models already have. The definition is stated in the rule authoring convention (`.claude/rules/quality-rules.md`) and in the user guide, and is the admission question the audit skill (T42) asks before it proposes a rule.

#### Scenario: definition in the convention and the guide

- **WHEN** the content test reads `.claude/rules/quality-rules.md` and the user guide page about rules
- **THEN** both state that a rule is a choice among valid alternatives, name the two kinds, and name the system fact and the process lesson as non-rules

### Requirement: Pack layout

The plugin SHALL ship its rules as one file per rule, `rules/<category>/<id>.md` for the categories and `rules/languages/<name>/<id>.md` for the languages, with the rule frontmatter of `kernel-state` (Rule file frontmatter), `origin: bdk` and an id of the form `BDK-<PREFIX>-<n>`.

| Directory                     | Prefix  | Category or language |
| ----------------------------- | ------- | -------------------- |
| `rules/code-quality/`         | `CQ`    | code quality         |
| `rules/architecture/`         | `ARCH`  | architecture         |
| `rules/design-patterns/`      | `DP`    | design patterns      |
| `rules/security/`             | `SEC`   | security             |
| `rules/test-quality/`         | `TQ`    | test quality         |
| `rules/engineering-judgment/` | `EJ`    | engineering judgment |
| `rules/plan/`                 | `PL`    | plan quality (P7)    |
| `rules/languages/javascript/` | `JS`    | JavaScript           |
| `rules/languages/typescript/` | `TS`    | TypeScript           |
| `rules/languages/react/`      | `REACT` | React                |

No other file lives under `rules/` except `rules/README.md`, which states the definition and the admission procedure. The pack is read from the installed plugin at run time, never copied into a project; a project switches a rule off with `rules.disabled` and adds its own rules under `.bdk/rules/`. A removed pack rule stays as a tombstone with `removed` and its body, so its id is never reused.

#### Scenario: pack files match their directory

- **WHEN** the content test reads every file under `rules/`
- **THEN** each file other than `rules/README.md` sits in a directory of the table, its id starts with `BDK-` and the directory's prefix, its file name equals its id, and it carries `origin: bdk`

#### Scenario: pack validates

- **WHEN** CI runs `bdk rules check` in the BDK repository
- **THEN** the exit code is 0

### Requirement: Pack admission

A rule SHALL enter the shipped pack only after the measurement procedure: M1 (the rule's question answered blind by Haiku and Sonnet, judged COVERED, MISSED or WRONG) and M2 (seeded violations reviewed with and without the rule, against an A/A noise floor), both run through the T40 harness (`skill-evals`). A `house` rule is admitted unless it is COVERED for both models in M1 and shows no measurable difference in M2 with a `without` mean detection of at least 0.8; a `knowledge` rule is admitted only when M1 is WRONG, MISSED or MIXED for at least one model. The procedure is mandatory for every new `rules/languages/<name>/` directory and for every rule added to an existing one. The `SEC` rules migrated from v2 are the one exception: they are kept without the house test, because a missed security problem costs more than the prompt space (T31 review of the migration report).

#### Scenario: knowledge rules carry their source

- **WHEN** the content test reads every pack rule with `kind: knowledge`
- **THEN** each carries `source` and `verified`

#### Scenario: new language pack without a measurement

- **WHEN** a pull request adds `rules/languages/go/` and `docs/V3-RULES-MIGRATION.md` or a later measurement report has no rows for its rules
- **THEN** the content test fails naming the directory

### Requirement: Plan rules

The pack SHALL hold the plan-quality rules of P7 under `rules/plan/`, read by the `verifier` role and by the `plan` stage context: `BDK-PL-1` a Definition of Done lists only conditions a reviewer can check in review (no deployment steps, no manual QA, no "the test used to fail"); `BDK-PL-2` executable fields carry no placeholder; `BDK-PL-3` every plan part names its `success-measure`.

#### Scenario: plan rules exist

- **WHEN** the content test reads `rules/plan/`
- **THEN** it finds `BDK-PL-1`, `BDK-PL-2` and `BDK-PL-3`, each `kind: house`

#### Scenario: verifier reads the plan rules

- **WHEN** a `verifier` package is built for a plan part
- **THEN** its `rules` holds `BDK-PL-1`, `BDK-PL-2` and `BDK-PL-3`

### Requirement: Migration report

The repository SHALL hold `docs/V3-RULES-MIGRATION.md`, recording for each of the 131 bullets T40 measured (`docs/V3-EVAL-RULES-NOOP.md`): its T40 id, text excerpt, T40 class, the spot-check correction applied, its kind (`house`, `knowledge` or not a rule), the decision (`kept as <id>` or `removed: <reason>`), and, for the bullets whose seeds were fixed, the re-measured M2 result; followed by the counts per decision and file. A bullet removed before numbering gets no id and no tombstone (T5).

#### Scenario: every measured bullet has a row

- **WHEN** the content test compares the T40 bullet ids in `evals/results/rules-noop/` with the rows of `docs/V3-RULES-MIGRATION.md`
- **THEN** every id has exactly one row with a decision

#### Scenario: kept bullets exist in the pack

- **WHEN** a row reads `kept as BDK-CQ-4`
- **THEN** `rules/code-quality/BDK-CQ-4.md` exists and is not a tombstone
