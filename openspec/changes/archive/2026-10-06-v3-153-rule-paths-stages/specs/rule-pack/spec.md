# Spec Delta

## MODIFIED Requirements

### Requirement: Pack layout

The plugin SHALL ship its rules as one file per rule, `rules/<category>/<id>.md` for the categories and `rules/languages/<name>/<id>.md` for the languages, with the rule frontmatter of `kernel-state` (Rule file frontmatter), `origin: bdk` and an id of the form `BDK-<PREFIX>-<n>`. Each rule states the `stages` and `paths` of its directory in the table below; a rule narrows its `paths` only for a stated reason, as `BDK-CQ-9` does for lockfiles (Pack admission). A directory's stages are every stage in which a reader read the category before stages existed, so moving to stages removed no rule from any reader. A language pack is a candidate only when its name is in `languages` (`kernel-settings`, Keys of the project toolchain); its `paths` narrow it to the files of that language.

| Directory                     | Prefix  | Category or language | `stages`                              | `paths`                                       |
| ----------------------------- | ------- | -------------------- | ------------------------------------- | --------------------------------------------- |
| `rules/code-quality/`         | `CQ`    | code quality         | `plan`, `execute`, `review`           | `**`                                          |
| `rules/architecture/`         | `ARCH`  | architecture         | `design`, `plan`, `execute`, `review` | `**`                                          |
| `rules/design-patterns/`      | `DP`    | design patterns      | `execute`, `review`                   | `**`                                          |
| `rules/security/`             | `SEC`   | security             | `design`, `execute`, `review`         | `**`                                          |
| `rules/test-quality/`         | `TQ`    | test quality         | `plan`, `execute`, `review`           | `**`                                          |
| `rules/engineering-judgment/` | `EJ`    | engineering judgment | `design`, `plan`                      | `**`                                          |
| `rules/plan/`                 | `PL`    | plan quality (P7)    | `plan`                                | `**`                                          |
| `rules/languages/javascript/` | `JS`    | JavaScript           | `plan`, `execute`, `review`           | `**/*.js`, `**/*.mjs`, `**/*.cjs`, `**/*.jsx` |
| `rules/languages/typescript/` | `TS`    | TypeScript           | `plan`, `execute`, `review`           | `**/*.ts`, `**/*.mts`, `**/*.cts`, `**/*.tsx` |
| `rules/languages/react/`      | `REACT` | React                | `plan`, `execute`, `review`           | `**/*.jsx`, `**/*.tsx`                        |

No other file lives under `rules/` except `rules/README.md`, which states the definition and the admission procedure. The pack is read from the installed plugin at run time, never copied into a project; a project switches a rule off with `rules.disabled` and adds its own rules under `.bdk/rules/`. A removed pack rule stays as a tombstone with `removed` and its body, so its id is never reused.

#### Scenario: pack files match their directory

- **WHEN** the content test reads every file under `rules/`
- **THEN** each file other than `rules/README.md` sits in a directory of the table, its id starts with `BDK-` and the directory's prefix, its file name equals its id, and it carries `origin: bdk`

#### Scenario: pack validates

- **WHEN** CI runs `bdk rules check` in the BDK repository
- **THEN** the exit code is 0

#### Scenario: pack rules state their stages and paths

- **WHEN** the content test reads every rule file under `rules/`
- **THEN** each carries the `stages` of its directory in the table, and the `paths` of its directory or, for `BDK-CQ-9`, its lockfile globs

### Requirement: Pack admission

A rule SHALL enter the shipped pack only after the measurement procedure: M1 (the rule's question answered blind by Haiku and Sonnet, judged COVERED, MISSED or WRONG) and M2 (seeded violations reviewed with and without the rule, against an A/A noise floor), both run through the T40 harness (`skill-evals`). A `house` rule is admitted unless it is COVERED for both models in M1 and shows no measurable difference in M2 with a `without` mean detection of at least 0.8; a `knowledge` rule is admitted only when M1 is WRONG, MISSED or MIXED for at least one model. The procedure is mandatory for every new `rules/languages/<name>/` directory and for every rule added to an existing one. The `SEC` rules migrated from v2 are the one exception: they are kept without the house test, because a missed security problem costs more than the prompt space (T31 review of the migration report). `BDK-CQ-9` (lockfiles are regenerated, never merged by hand) is the second exception (user decision 2026-10-04, Change `v3-t45-worktree-isolation`): models know the rule when asked, so M1 would read COVERED, but they break it while resolving a conflict; its `paths` scope it to lockfiles, so it costs prompt space only in packages that touch one.

#### Scenario: knowledge rules carry their source

- **WHEN** the content test reads every pack rule with `kind: knowledge`
- **THEN** each carries `source` and `verified`

#### Scenario: new language pack without a measurement

- **WHEN** a pull request adds `rules/languages/go/` and `docs/V3-RULES-MIGRATION.md` or a later measurement report has no rows for its rules
- **THEN** the content test fails naming the directory

#### Scenario: lockfile rule admitted without measurement

- **WHEN** the content test reads `rules/code-quality/BDK-CQ-9.md`
- **THEN** it has `kind: house`, a `paths` list naming at least `**/pnpm-lock.yaml`, `**/package-lock.json`, `**/yarn.lock`, `**/Cargo.lock`, `**/poetry.lock`, `**/uv.lock`, `**/go.sum`, `**/Gemfile.lock` and `**/composer.lock`, and the measurement check does not require rows for it

### Requirement: Plan rules

The pack SHALL hold the plan-quality rules of P7 under `rules/plan/`, with `stages: [plan]`, so the `verifier` role, the `plan` skill context and the `plan` node instruction read them (`kernel-cli/rules`, Stage readers): `BDK-PL-1` a Definition of Done lists only conditions a reviewer can check in review (no deployment steps, no manual QA, no "the test used to fail"); `BDK-PL-2` executable fields carry no placeholder; `BDK-PL-3` every plan part names its `success-measure`; `BDK-PL-4` a part that shares state outside its `Files:` with a part of the same wave runs in a worktree, with the state named in `isolation-reason`, and no other part does (T45).

#### Scenario: plan rules exist

- **WHEN** the content test reads `rules/plan/`
- **THEN** it finds `BDK-PL-1`, `BDK-PL-2`, `BDK-PL-3` and `BDK-PL-4`, each `kind: house`

#### Scenario: verifier reads the plan rules

- **WHEN** a `verifier` package is built for a plan part
- **THEN** its `rules` holds `BDK-PL-1`, `BDK-PL-2`, `BDK-PL-3` and `BDK-PL-4`
