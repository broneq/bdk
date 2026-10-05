# Spec Delta

## ADDED Requirements

### Requirement: Repository rules managed by the kernel

BDK's own repository SHALL keep its development rules the way v3 asks of a user project: one file per rule under `.bdk/rules/`, each with an id and passing `bdk rules check`, and `.claude/rules/` holding only the two files `bdk rules export --claude` generates. A rule is admitted only when it passes the content admission test: it survives a refactor that changes no decision (durability), an agent would make a wrong change without it (decision), the trap is invisible where the mistake is made (visibility), and the agent cannot infer it from code, types or a failing test (derivability). A definition of how the system works lives in the spec that owns it, and a procedure lives in `CONTRIBUTING.md`, never in a rule. A contract test SHALL fail when `.claude/rules/` holds a file other than the generated projection, or when `bdk rules export --claude --check` reports drift.

#### Scenario: a hand-written rule file is added

- **WHEN** a contributor adds `.claude/rules/naming.md` by hand
- **THEN** `pnpm test:contract` fails, names the file and tells to run `bdk rules import`

#### Scenario: a rule edited without regenerating the projection

- **WHEN** a file under `.bdk/rules/` changes and `bdk rules export --claude` is not rerun
- **THEN** `pnpm test:contract` fails with the projection drift

#### Scenario: doctor on the BDK repository

- **WHEN** `bdk doctor --json` runs in the BDK repository
- **THEN** it reports no `rule-without-id`, `rules-invalid` or `projection-outdated` finding
