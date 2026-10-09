## MODIFIED Requirements

### Requirement: Run the checks

`bdk check run <run-dir> <id> [--scope <path>]... [--kind <kind>]... [--round <n>]` SHALL run the project's configured check commands and record their result. `<run-dir>` is the run directory of a Change (by convention `.bdk/runs/<change>/`, an absolute path for a caller in another worktree), relative to the working directory; it SHALL exist. `<id>` names the result and SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`); the caller picks it (a part id, `round-2`), so parallel callers with different ids never share a file. `--scope` is repeatable, one path per value, relative to the project root. `--kind` is repeatable and takes `test`, `lint` or `build`.

The command SHALL read the resolved configuration (spec `bdk-cli/config`) and run these entries, in this order, each kind in the order its items resolve: `tools.test`, then `tools.lint`, then `tools.build`; with `--kind`, only the kinds named. For each entry it SHALL run:

- without `--scope`: the entry's `command`; the entry's `paths` is not read;
- with `--scope` and an entry whose `paths` match no scope path: nothing; the entry is skipped;
- with `--scope` and a `scoped` variant: `scoped`, with every `{files}` replaced by the entry's files, separated by one space, each path left as is when it consists only of `A-Z a-z 0-9 _ . / @ % + = : , -` and otherwise quoted for the POSIX shell in single quotes;
- with `--scope` and no `scoped` variant: the entry's `command`, the whole project.

The entry's files SHALL be the scope paths, deduplicated and sorted by code unit, that its `paths` match; all of them when the entry has no `paths`. A path SHALL match when it matches at least one glob of `paths` as a rule path matches a file (spec `bdk-cli/rules`, "Rules for a stage and files"): after a leading `./` is dropped, a glob's `*` does not cross `/`, `**` matches any number of directories, and dot files match like any other file. The path SHALL go into `{files}` as given. A skipped entry SHALL run no command and write no output file; it is no check of the result, and the result lists it under `skipped`.

Each command SHALL run through `/bin/sh -c` in the project root, the directory the configuration was resolved in (spec `bdk-cli/config`), with the environment of the CLI, stdin at end of file, and stdout and stderr written together, in the order they arrive, to its output file. The commands SHALL run one after another, every one of them even after a red one. A command still running after its timeout, the entry's `timeout` or 600 seconds, SHALL be killed together with every process it started in its process group. When a command exits, every process it left running in its process group SHALL be killed, so nothing writes to the output file after its last line. When the CLI itself is ended by `SIGINT`, `SIGTERM` or `SIGHUP` while a command runs, it SHALL kill that command's process group before it ends, so no check outlives the call.

A check SHALL be `pass` when its command exits 0, `timeout` when it was killed at its timeout, and `fail` otherwise; a command ended by a signal it did not get from the timeout counts as exit 128 plus the signal number. The verdict SHALL be `fail` when any check is not `pass`, `none` when no check ran (no entry was selected, or every selected entry was skipped), and `pass` otherwise. The command SHALL write the result file and the output files in every case, print the result, and exit 1 when the verdict is `fail`, 0 otherwise; a red check is the answer "no" of spec `bdk-cli`, "Exit codes", not an error.

#### Scenario: Scoped run writes a result file

- **WHEN** the configuration has the `tools.test` item `unit` with `scoped: "vitest run {files}"` and the `tools.lint` item `eslint` with only `command: "eslint ."`, and `bdk check run .bdk/runs/v3-1-x 02 --scope src/b.ts --scope src/a.ts` runs
- **THEN** it runs `vitest run src/a.ts src/b.ts` and then `eslint .`, writes `.bdk/runs/v3-1-x/checks/02.json` with one check per command, each with its status and output path, and exits 0 when both commands exit 0

#### Scenario: Scope filtered per entry

- **WHEN** the configuration has the `tools.test` items `api` with `paths: ["api/**"]` and `scoped: "uv run pytest {files}"`, and `web` with `paths: ["web/**"]` and `scoped: "pnpm vitest run {files}"`, and `bdk check run <run-dir> 02 --scope web/src/a.tsx` runs
- **THEN** it runs only `pnpm vitest run web/src/a.tsx`, the result holds one check, `test web`, and lists `{"kind": "test", "tool": "api"}` under `skipped`, and no output file of `api` is written

#### Scenario: Each entry gets only its files

- **WHEN** the same configuration runs with `--scope web/src/a.tsx --scope api/app.py --scope ./api/tests/test_app.py`
- **THEN** it runs `uv run pytest ./api/tests/test_app.py api/app.py` and then `pnpm vitest run web/src/a.tsx`, and `skipped` is empty

#### Scenario: Entry with paths and no scoped variant

- **WHEN** the `tools.lint` item `ruff` has `paths: ["**/*.py"]` and only `command: "uv run ruff check ."`, and the scope holds `api/app.py`
- **THEN** `ruff` runs `uv run ruff check .`, not scoped; with a scope of only `web/src/a.tsx` it is skipped

#### Scenario: Every entry skipped

- **WHEN** every selected entry has `paths` and none matches a scope path
- **THEN** no command runs, the verdict is `none`, the result file lists every entry under `skipped`, and the exit code is 0

#### Scenario: Paths ignored without a scope

- **WHEN** `bdk check run <run-dir> full` runs without `--scope` on entries with `paths`
- **THEN** every selected entry runs its `command` and `skipped` is empty

#### Scenario: Full run

- **WHEN** `bdk check run <run-dir> full` runs without `--scope`
- **THEN** every selected entry runs its `command`, and the result marks every check as not scoped

#### Scenario: Red check

- **WHEN** one of two commands exits 2
- **THEN** both commands run, that check is `fail` with exit 2 and the last lines of its output, the verdict is `fail`, the result file is written, and the exit code is 1

#### Scenario: Timeout

- **WHEN** an entry has `timeout: 1` and its command starts a child process that sleeps for 60 seconds
- **THEN** after about one second the command and its child are killed, the check is `timeout`, its output file ends with the line `timeout 1`, and the exit code is 1

#### Scenario: Left-over process killed

- **WHEN** a command starts a background process and exits 0
- **THEN** the background process is killed, and the output file ends with the line `exit 0`

#### Scenario: CLI interrupted

- **WHEN** the CLI gets `SIGTERM` while a command that started a child process runs
- **THEN** the command and its child are killed and the CLI ends

#### Scenario: Path with a replacement pattern

- **WHEN** the scope holds `src/a$&.ts`
- **THEN** `{files}` becomes `'src/a$&.ts'`, character for character

#### Scenario: Stdin closed

- **WHEN** a command reads stdin, and the CLI's stdin is a pipe that never closes
- **THEN** the command reads end of file at once and the check finishes

#### Scenario: Path quoted for the shell

- **WHEN** the scope holds `src/a b.ts` and `src/it's.ts`
- **THEN** `{files}` becomes `'src/a b.ts' 'src/it'\''s.ts'`

#### Scenario: Only some kinds

- **WHEN** `bdk check run <run-dir> 02 --kind lint` runs on a configuration with test, lint and build entries
- **THEN** only the `tools.lint` entries run, and the result names only lint checks

#### Scenario: Nothing configured

- **WHEN** the configuration has no `tools.test`, `tools.lint` or `tools.build` item
- **THEN** no command runs, the verdict is `none`, the result file is written with no check, and the exit code is 0

### Requirement: Result file

The result SHALL be written to `<run-dir>/checks/<id>.json`, replacing an earlier result of the same id, as one JSON object followed by a newline; `--json` SHALL print the same object. The object SHALL hold:

| Field | Value |
| ----- | ----- |
| `version` | `1` |
| `id` | the `<id>` argument |
| `scope` | the scope paths, deduplicated and sorted by code unit, or `null` without `--scope` |
| `verdict` | `pass`, `fail` or `none` |
| `checks` | one object per selected entry that ran, in run order |
| `skipped` | one object `{"kind", "tool"}` per selected entry skipped because its `paths` match no scope path, in run order; empty without `--scope` |
| `findings` | with `--round`: `{"log": <path of the findings log>, "ids": [<finding id per red check, in check order>]}`; otherwise `null` |

A check SHALL hold `kind` (`test`, `lint` or `build`), `tool` (the entry's `id`), `command` (the command line as run), `scoped` (whether the `scoped` variant ran), `status` (`pass`, `fail` or `timeout`), `exit` (the exit code, `null` for a timeout), `timeout` (the timeout in seconds), `output` (the path of its output file, `<run-dir>` joined as given) and `tail` (the last 20 lines of its output without the exit line, `null` for a `pass` check). The object SHALL hold no time stamp or duration, so the same commands with the same outputs give a byte-identical result.

#### Scenario: Result valid against the schema

- **WHEN** `bdk check run <run-dir> 02 --json` runs
- **THEN** stdout is one JSON document valid against the command's output schema, and it is byte-identical to `<run-dir>/checks/02.json`

#### Scenario: Earlier result replaced

- **WHEN** `bdk check run <run-dir> 02` runs twice and the second run has a different verdict
- **THEN** `<run-dir>/checks/02.json` holds the second result only

### Requirement: Check run text output

In text mode the command SHALL print one line per check in run order with its status, kind, tool, `scoped` or `full`, and output path; under each check that is not `pass`, its tail, each line indented; one `skip` line per skipped entry with its kind and tool and that no scope file matches its `paths`; then the verdict with the count of red checks, the path of the result file and, with `--round`, the number of findings appended and the log path.

#### Scenario: Text of a red run

- **WHEN** `bdk check run <run-dir> 02` runs and the lint check fails
- **THEN** stdout holds a `fail` line for the lint check followed by its indented tail, then `verdict: fail` and the result file path, and the exit code is 1

#### Scenario: Text of a skipped entry

- **WHEN** `bdk check run <run-dir> 02 --scope web/src/a.tsx` skips the `tools.test` item `api`
- **THEN** stdout holds a `skip` line naming `test api` and that no scope file matches its `paths`
