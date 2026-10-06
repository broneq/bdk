## ADDED Requirements

### Requirement: Repository development rules in .claude/rules

BDK's own repository SHALL keep its development rules as hand-written Markdown files under `.claude/rules/`, where Claude Code loads them, each scoped with `paths:` when it governs only part of the tree. The repository SHALL hold no `.bdk/rules/` directory: BDK's project rules are a feature for user projects, and the repository's conventions are for the sessions that develop BDK. A rule is admitted only when it passes the content admission test: it survives a refactor that changes no decision (durability), an agent would make a wrong change without it (decision), the trap is invisible where the mistake is made (visibility), and the agent cannot infer it from code, types or a failing test (derivability). A definition of how the system works lives in the spec that owns it, and a procedure lives in `CONTRIBUTING.md`, never in a rule.

#### Scenario: skill rules load for a skill file

- **WHEN** a session in the BDK repository edits `skills/stages/close/SKILL.md`
- **THEN** the rules for writing skills and prompts reach it from a file under `.claude/rules/` whose `paths:` covers `skills/**`

#### Scenario: doctor on the BDK repository

- **WHEN** `bdk doctor --json` runs in the BDK repository
- **THEN** it reports no `rules-invalid` finding

## REMOVED Requirements

### Requirement: Repository rules managed by the kernel

**Reason**: It kept BDK's development rules under `.bdk/rules/` and made them reach the developing session only through the `bdk rules export --claude` projection, which this change removes (`kernel-cli/rules`).

**Migration**: The 13 rules move into hand-written `.claude/rules/` files (Requirement: Repository development rules in .claude/rules), and the contract test that allowed only the projection under `.claude/rules/` is deleted.
