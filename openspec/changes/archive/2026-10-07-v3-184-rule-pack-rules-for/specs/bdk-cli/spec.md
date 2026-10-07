# Spec Delta

## MODIFIED Requirements

### Requirement: Invocation and routing

The CLI SHALL be called as `bdk <group> [<verb>] [arguments] [flags]`, where a command is identified by its group and, for a group with several commands, its verb. Flags SHALL be accepted before or after the arguments. A command MAY declare a string flag repeatable: each occurrence then adds one value, and the command receives the values in the order given. An unknown group, an unknown verb, an unknown flag, a missing required argument or an invalid argument value SHALL be a usage error that names what was wrong and, for an unknown name, the known names closest to it.

#### Scenario: Unknown group

- **WHEN** `bdk confgi show` runs and a `config` group exists
- **THEN** the CLI reports the usage error `usage/unknown-command`, names `confgi` and suggests `config`, and exits 2

#### Scenario: Unknown flag

- **WHEN** a known command runs with a flag it does not declare
- **THEN** the CLI reports the usage error `usage/unknown-flag` naming the flag and exits 2, and the command does not run

#### Scenario: Repeatable flag

- **WHEN** a command with the repeatable string flag `--files` runs as `bdk <group> <verb> --files a.ts --json --files b.ts`
- **THEN** the command receives `["a.ts", "b.ts"]` for `--files`

### Requirement: Help

`bdk`, `bdk --help` and `bdk -h` SHALL print the global help: the usage line, every command group with one line each, and the global flags. For a group with several commands, `bdk <group>` and `bdk <group> --help` SHALL print the group's commands with one line each. `bdk <group> <verb> --help` SHALL print the command's usage, arguments, flags and exit codes, and mark a repeatable flag `(repeatable)`. Help SHALL go to stdout with exit 0. The help of a command SHALL come from the declaration of the command in its own slice; there is no separate index of commands.

#### Scenario: Global help

- **WHEN** `bdk --help` runs
- **THEN** stdout holds the usage line, one line per command group and the global flags `--help`, `--version` and `--json`, and the exit code is 0

#### Scenario: Command help does not run the command

- **WHEN** `bdk <group> <verb> --help` runs for a command that writes files
- **THEN** the command's help is printed, no file is written, and the exit code is 0

#### Scenario: Repeatable flag in the help

- **WHEN** `bdk rules for --help` runs
- **THEN** the flag line of `--files <value>` ends with `(repeatable)`
