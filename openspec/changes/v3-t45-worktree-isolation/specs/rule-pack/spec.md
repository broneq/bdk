## MODIFIED Requirements

### Requirement: Pack admission

A rule SHALL enter the shipped pack only after the measurement procedure: M1 (the rule's question answered blind by Haiku and Sonnet, judged COVERED, MISSED or WRONG) and M2 (seeded violations reviewed with and without the rule, against an A/A noise floor), both run through the T40 harness (`skill-evals`). A `house` rule is admitted unless it is COVERED for both models in M1 and shows no measurable difference in M2 with a `without` mean detection of at least 0.8; a `knowledge` rule is admitted only when M1 is WRONG, MISSED or MIXED for at least one model. The procedure is mandatory for every new `rules/languages/<name>/` directory and for every rule added to an existing one. The `SEC` rules migrated from v2 are the one exception: they are kept without the house test, because a missed security problem costs more than the prompt space (T31 review of the migration report). `BDK-CQ-9` (lockfiles are regenerated, never merged by hand) is the second exception (user decision 2026-10-04, Change `v3-t45-worktree-isolation`): models know the rule when asked, so M1 would read COVERED, but they break it while resolving a conflict; its `applies` scopes it to lockfiles, so it costs prompt space only in packages that touch one.

#### Scenario: knowledge rules carry their source

- **WHEN** the content test reads every pack rule with `kind: knowledge`
- **THEN** each carries `source` and `verified`

#### Scenario: new language pack without a measurement

- **WHEN** a pull request adds `rules/languages/go/` and `docs/V3-RULES-MIGRATION.md` or a later measurement report has no rows for its rules
- **THEN** the content test fails naming the directory

#### Scenario: lockfile rule admitted without measurement

- **WHEN** the content test reads `rules/code-quality/BDK-CQ-9.md`
- **THEN** it has `kind: house`, an `applies` list naming at least `**/pnpm-lock.yaml`, `**/package-lock.json`, `**/yarn.lock`, `**/Cargo.lock`, `**/poetry.lock`, `**/uv.lock`, `**/go.sum`, `**/Gemfile.lock` and `**/composer.lock`, and the measurement check does not require rows for it

### Requirement: Plan rules

The pack SHALL hold the plan-quality rules of P7 under `rules/plan/`, read by the `verifier` role and by the `plan` stage context: `BDK-PL-1` a Definition of Done lists only conditions a reviewer can check in review (no deployment steps, no manual QA, no "the test used to fail"); `BDK-PL-2` executable fields carry no placeholder; `BDK-PL-3` every plan part names its `success-measure`; `BDK-PL-4` a part that shares state outside its `Files:` with a part of the same wave runs in a worktree, with the state named in `isolation-reason`, and no other part does (T45).

#### Scenario: plan rules exist

- **WHEN** the content test reads `rules/plan/`
- **THEN** it finds `BDK-PL-1`, `BDK-PL-2`, `BDK-PL-3` and `BDK-PL-4`, each `kind: house`

#### Scenario: verifier reads the plan rules

- **WHEN** a `verifier` package is built for a plan part
- **THEN** its `rules` holds `BDK-PL-1`, `BDK-PL-2`, `BDK-PL-3` and `BDK-PL-4`
