# bdk-cli Specification

## Purpose

Defines the frame every `bdk` command shares - invocation, help, version, output, errors, exit codes - and the source architecture every command follows, so that the CLI stays a helper that computes or saves a model turn and never governs the work (ADR-0003). Command groups specify their own commands in `bdk-cli/<group>`.

## Requirements

### Requirement: Commands help, they never govern

A `bdk` command SHALL compute a result from its arguments and the files it reads, or write what it was asked to write, and return. No command SHALL hold the order of a process, record which step of a skill ran so that a later command can check it, or refuse work because another `bdk` command did not run before it.

#### Scenario: Result independent of earlier calls

- **WHEN** the same command runs twice with the same arguments on the same files, once in a fresh shell and once after any sequence of other `bdk` commands that wrote nothing it reads
- **THEN** both runs print the same result and exit with the same code

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

### Requirement: Version

`bdk --version` SHALL print exactly the plugin version from `.claude-plugin/plugin.json` followed by a newline, on stdout, and exit 0, also with `--json`.

#### Scenario: Version from the built CLI

- **WHEN** `bdk --version` runs from the built plugin
- **THEN** stdout is the `version` of `plugins/bdk/.claude-plugin/plugin.json` and a newline, and the exit code is 0

### Requirement: Output streams

stdout SHALL hold only the result of the command, or the error object under `--json`. stderr SHALL hold only errors and warnings in text mode. The CLI SHALL NOT print colour codes or other terminal control sequences, progress output, or anything that depends on whether stdout is a terminal, and SHALL list items in a stable order, so that the same input gives byte-identical output.

#### Scenario: Not a terminal

- **WHEN** a command runs once with stdout on a terminal and once with stdout piped to a file
- **THEN** both outputs are byte-identical and hold no escape character

### Requirement: JSON output

Every command SHALL accept the global flag `--json`. With `--json`, stdout SHALL hold exactly one JSON document followed by a newline: the command's result, valid against the output schema the command declares, or the error object. stderr SHALL stay empty. The tests of each command SHALL validate its JSON output against that schema.

#### Scenario: Result under --json

- **WHEN** a command that succeeds runs with `--json`
- **THEN** stdout parses as one JSON document that is valid against the command's output schema, and stderr is empty

#### Scenario: Error under --json

- **WHEN** a command fails with a usage error under `--json`
- **THEN** stdout parses as one JSON document `{"error": {"code": ..., "message": ..., "hint": ...}}`, stderr is empty, and the exit code is 2

### Requirement: Errors

An error SHALL carry a `code` of the form `<class>/<name>`, where the class is `usage`, `env` or `internal`, a `message` saying what went wrong, and an optional `hint` saying what to do instead. In text mode the CLI SHALL print `bdk: <message>` and, when present, `hint: <hint>` on stderr. A `code` SHALL NOT change meaning once released, because skills and tests match on it.

#### Scenario: Text error

- **WHEN** `bdk confgi` runs without `--json`
- **THEN** stderr holds `bdk: ` followed by the message and a `hint: ` line, stdout is empty, and the exit code is 2

### Requirement: Exit codes

The CLI SHALL exit with one of these codes, and only these:

| Code | Meaning                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Success.                                                                                                                                   |
| 1    | The command ran and its answer is "no" (for example a check found problems); the result is on stdout as on success, not an error object. |
| 2    | Usage error (`usage/*`): unknown command or flag, missing or invalid argument.                                                             |
| 3    | Environment error (`env/*`): a file, a directory, a tool or a Node version the command needs is missing or unusable.                      |
| 4    | Internal error (`internal/*`): a defect in the CLI; text mode prints the stack trace on stderr.                                            |

A non-zero exit code SHALL be information for the calling skill, which decides what happens next; the CLI SHALL NOT use an exit code to stop a skill.

#### Scenario: Unexpected exception

- **WHEN** a command throws an exception that no layer turned into an error
- **THEN** the CLI prints `bdk: internal error` with the stack trace on stderr, or the error object with code `internal/unexpected` under `--json`, and exits 4

#### Scenario: Node too old

- **WHEN** the CLI starts on a Node version older than 22.18
- **THEN** it reports `env/node-version` naming the running and the required version and exits 3

### Requirement: No waiting on input

No command SHALL read stdin unless one of its arguments is `-`, which the command's help SHALL state. No command SHALL prompt, wait for a key or a terminal, or keep running after its result is printed.

#### Scenario: Stdin left open

- **WHEN** a command whose arguments contain no `-` runs with stdin connected to a pipe that never closes
- **THEN** the command finishes and exits as it would with stdin closed

### Requirement: Vertical slices

The CLI source in `plugins/bdk/src/` SHALL be organised as one slice per command group, `src/<group>/`, plus `shared/` and the composition root `src/main.ts`. A slice SHALL own the whole vertical of its commands: argv parsing into a typed input and the command's help, the use case, its persistence, text rendering, the JSON output schema, and the unit tests next to the code. `src/main.ts` SHALL be the only file that imports every slice and the only file outside `shared/` that touches the process (argv, environment, streams, exit code).

#### Scenario: Slice parity

- **WHEN** `pnpm lint` compares the directories under `src/` (other than `shared/`) with the slices named in the slice matrix
- **THEN** the two sets are equal, or the lint run fails naming the extra or missing slice

#### Scenario: New command lands in one slice

- **WHEN** a Change adds a verb to an existing group
- **THEN** it changes files under that group's slice, the group's spec `bdk-cli/<group>` and tests only

### Requirement: Slice anatomy

Every slice SHALL use the same layout, one file per command inside each layer, so a command sits at the same relative path in every layer:

| Path         | Holds                                                                                          | May import                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `index.ts`   | The slice's public surface: its command declarations and what other slices may call            | its own layers, `shared/`                                                    |
| `commands/`  | argv to typed input, help text, the call of the use case, choice of text or JSON               | `use-cases/`, `render/`, `schema/`, `domain/`, `shared/`                     |
| `use-cases/` | The logic of one command; no argv, no stdout                                                   | `domain/`, `store/`, `schema/`, the `index.ts` of slices in its matrix row, `shared/` |
| `domain/`    | Types and pure rules; no IO                                                                    | `domain/` of the same slice                                                  |
| `store/`     | Optional: the slice's own files, read and written through `shared/` boundaries                 | `domain/`, `shared/`                                                         |
| `render/`    | Text rendering of a result; the JSON form is the result object itself                          | `domain/`, `schema/`, `shared/`                                              |
| `schema/`    | The JSON output schema of each command                                                         | `domain/`, `shared/`                                                         |
| `tests/`     | Unit tests of the slice                                                                        | anything in the same slice, `shared/`                                        |

A slice without pure rules MAY omit `domain/`, and a slice without files of its own omits `store/`.

#### Scenario: Layer direction

- **WHEN** a file under `commands/` imports `store/`, a file under `render/` imports `use-cases/`, or a file under `domain/` imports anything outside its slice's `domain/`
- **THEN** the lint run fails

### Requirement: Import matrix

A slice SHALL import another slice only through that slice's `index.ts` and only along a row of the slice matrix, which lists for every slice the slices it may import. The matrix SHALL stay acyclic. `shared/` SHALL NOT import a slice. An edge is added to the matrix only for a use case or domain rule that the other slice owns; data that several slices read goes through `shared/` instead.

#### Scenario: Import outside the matrix

- **WHEN** a file of slice `a` imports slice `b` and the matrix row of `a` does not list `b`
- **THEN** the lint run fails and names the file and the edge

#### Scenario: Deep import

- **WHEN** a file of slice `a` imports a file of slice `b` other than `b/index.ts`
- **THEN** the lint run fails

#### Scenario: Cycle

- **WHEN** the matrix lists `a` importing `b` and `b` importing `a`, directly or through other slices
- **THEN** the lint run fails

### Requirement: shared/ admission

A module SHALL enter `shared/` for one of three reasons, which the slice matrix records next to it: it is an OS boundary (file system, child processes, clock, environment, network), it is the CLI frame (routing, help, flags, output, errors, exit codes), or three or more slices import it. Anything else SHALL live in the slice that needs it, even when a second slice holds a copy.

#### Scenario: Shared module with too few users

- **WHEN** a `shared/` module admitted because three or more slices use it is imported by fewer than three slices
- **THEN** the workspace tests fail and names the module

### Requirement: OS boundary

Node modules that reach the operating system (`node:fs`, `node:fs/promises`, `node:child_process`, `node:os`, `node:net`, `node:http`, `node:https`, `node:readline`, `node:tty`, `node:worker_threads`) and the global `process` SHALL appear only in `src/main.ts` and in the `shared/` modules admitted as OS boundaries, so that every use case runs in unit tests against injected boundaries.

#### Scenario: File system in a use case

- **WHEN** a file under a slice imports `node:fs` or reads `process.env`
- **THEN** the lint run fails and names the file
