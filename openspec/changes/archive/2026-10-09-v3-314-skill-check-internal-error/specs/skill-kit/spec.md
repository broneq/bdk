## MODIFIED Requirements

### Requirement: Invocation and exit codes

`skill-check [paths...] [--config <file>] [--portable] [--json] [--strict] [--baseline <file>] [--baseline-init] [--baseline-prune]` SHALL load the config (`skill-check.config.ts`, `.mjs` or `.js` in the working directory unless `--config` is given), check every target, and exit with one of four codes:

- 0 when no error-severity finding remains after the baseline;
- 1 when an error-severity finding remains, when a baseline entry is stale, or, under `--strict`, when a warning remains;
- 2 on a usage or configuration error, with the reason on stderr as `skill-check: <reason>` and no findings printed;
- 3 on any other error (an internal error: discovery, a rule or the checker itself failed), with one line on stderr as `skill-check: internal error: <message>` and no findings printed. When a rule threw, the message SHALL name the rule ID and the file it was checking (or say it was a project check). The stack trace SHALL NOT be printed unless the environment variable `SKILL_CHECK_DEBUG` is set to a non-empty value; then it SHALL follow that line on stderr.

Path arguments narrow per-file rules to those skill directories or agent files. Project rules always see every target. `--list-rules` SHALL print the rule IDs that the config enables for at least one target, `--version` the kit version, and `--help` the usage text, which is the only usage reference and SHALL list every exit code and `SKILL_CHECK_DEBUG`.

`--explain <rule>` SHALL load the config, resolve the rule ID among the generic rules and the rules of the config's plugins, and print to stdout the rule's ID, the kinds it applies to and its default severity, then its explanation, and exit 0. An unknown rule ID SHALL be a usage error (exit 2) that names the ID. A rule without an explanation SHALL print the ID line and a line saying that the rule has no explanation.

#### Scenario: clean tree

- **WHEN** every target passes every enabled rule
- **THEN** the exit code is 0 and the output says no findings remain

#### Scenario: configuration error

- **WHEN** the config names an unknown rule ID, a target directory that does not exist, or a plugin that fails to load
- **THEN** the exit code is 2 and stderr names the offending entry

#### Scenario: strict mode

- **WHEN** only warnings remain and `--strict` is given
- **THEN** the exit code is 1

#### Scenario: path arguments narrow per-file rules only

- **WHEN** `skill-check skills/beta` runs on a tree with the skills `alpha` and `beta`
- **THEN** per-file rules report only on `skills/beta`, and project rules still see both skills

#### Scenario: explain a generic rule

- **WHEN** `skill-check --explain cli-front` runs in a project with a config
- **THEN** stdout opens with `cli-front`, its kinds and default severity, followed by the explanation, and the exit code is 0

#### Scenario: explain a plugin rule

- **WHEN** the config loads a plugin `acme` whose rule `no-todo` carries an explanation and `skill-check --explain acme/no-todo` runs
- **THEN** stdout holds that explanation and the exit code is 0

#### Scenario: explain an unknown rule

- **WHEN** `skill-check --explain nope` runs
- **THEN** the exit code is 2 and stderr names `nope`

#### Scenario: a rule throws

- **WHEN** the config loads a plugin whose rule `t/boom` throws a plain `Error("boom")` while checking `skills/alpha/SKILL.md`
- **THEN** the exit code is 3, stdout is empty, and stderr is the single line `skill-check: internal error: rule t/boom failed on skills/alpha/SKILL.md: boom` with no stack trace

#### Scenario: discovery fails

- **WHEN** discovery fails with an unexpected file system error
- **THEN** the exit code is 3, stderr is one `skill-check: internal error:` line holding the error's message, and no stack trace is printed

#### Scenario: stack trace on request

- **WHEN** a rule throws and `SKILL_CHECK_DEBUG=1` is set
- **THEN** the exit code is 3 and stderr holds the `skill-check: internal error:` line followed by the stack trace

#### Scenario: help lists every exit code

- **WHEN** `skill-check --help` runs
- **THEN** stdout lists the exit codes 0, 1, 2 and 3 and names `SKILL_CHECK_DEBUG`
