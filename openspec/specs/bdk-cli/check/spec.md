# bdk-cli/check Specification

## Purpose

The `bdk check` command group: `bdk check plan` resolves which of the project's configured test, lint and build commands a check runs, on which files, and prints for each the line the calling agent runs as its own Bash call (stdin closed, output to a file in the Change's run directory, a Bash timeout per command); `bdk check record` takes the exit codes the agent reports, writes the result and appends red checks to a review round's findings log. So the transcript shows each real command and its exit code, and a resumed caller reads the result instead of running it again. It runs no command and never decides what a red check means for the work (spec `bdk-cli`).

## Requirements

### Requirement: Output files

The output of each planned check SHALL go to `<run-dir>/checks/<id>/<kind>-<tool>.txt`, where `<tool>` is the entry's `id`: the printed line writes the command's stdout and stderr there, together and in arrival order, replacing a file of that name. After `bdk check record`, the file of a check with an exit code or a timeout SHALL end with, on a line of its own, `exit <code>` or `timeout <seconds>`.

#### Scenario: Exit line

- **WHEN** the line of the `tools.lint` item `eslint` of the plan `02` runs, prints `ok`, and `bdk check record <run-dir> 02 --exit lint-eslint=0` runs
- **THEN** `<run-dir>/checks/02/lint-eslint.txt` holds `ok` followed by the line `exit 0`

### Requirement: Result file

`bdk check record` SHALL write the result to `<run-dir>/checks/<id>.json`, replacing an earlier result of the same id, as one JSON object followed by a newline; its `--json` SHALL print the same object. The object SHALL hold:

| Field | Value |
| ----- | ----- |
| `version` | `3` |
| `id` | the `<id>` argument |
| `at` | the plan's `--at` point, or `null` |
| `changed` | the plan's `--changed` revision as given, or `null` |
| `scope` | the plan's run files, or `null` |
| `tests` | the plan's picked tests, or `null` without `--tests` |
| `verdict` | `pass`, `fail` or `none` |
| `checks` | one object per planned check, in plan order |
| `skipped` | the plan's skipped entries |
| `findings` | with `--round`: `{"log": <path of the findings log>, "ids": [<finding id per red check, in check order>]}`; otherwise `null` |

A check SHALL hold `kind` (`test`, `lint` or `build`), `tool` (the entry's `id`), `command` (the command line planned), `cwd` (the project root it runs in), `scoped` (whether the entry's command held `{files}`), `status` (`pass`, `fail`, `timeout` or `not-run`), `exit` (the exit code, `null` for `timeout` and `not-run`), `timeout` (the timeout in seconds), `output` (the path of its output file, `<run-dir>` joined as given) and `tail` (the last 20 lines of its output without the exit line, `null` for a `pass` or `not-run` check). The object SHALL hold no time stamp or duration, so the same plan with the same codes and outputs gives a byte-identical result.

#### Scenario: Result valid against the schema

- **WHEN** `bdk check record <run-dir> 02 --exit test-vitest=0 --json` runs
- **THEN** stdout is one JSON document valid against the command's output schema, it is byte-identical to `<run-dir>/checks/02.json`, and its check holds the command, the `cwd`, the exit code and the status

#### Scenario: Earlier result replaced

- **WHEN** `bdk check record <run-dir> 02` runs twice with different codes
- **THEN** `<run-dir>/checks/02.json` holds the second result only

### Requirement: Red checks as findings

With `--round <n>`, a positive integer, `bdk check record` SHALL append one `finding` event per check that is not `pass` to `<run-dir>/review/round-<n>/findings.jsonl`, through the findings log of spec `bdk-cli/findings`, creating the file when it is missing. The finding SHALL have `source` `check-run`, `rule` `check/<kind>/<tool>`, `summary` `<kind> <tool> failed with exit <code>`, `<kind> <tool> timed out after <seconds> s` or `<kind> <tool> was not run`, and `evidence` the path of the check's output file, and no `file` or `line`. A green check SHALL append nothing. Because the finding id comes from the dedupe key, the same red check in a later record of the same round gets the same id.

#### Scenario: Red check appended

- **WHEN** `bdk check record <run-dir> round-2 --round 2 --exit lint-eslint=1` records the `tools.lint` item `eslint`
- **THEN** `<run-dir>/review/round-2/findings.jsonl` gains one `finding` line with `source` `check-run` and `rule` `check/lint/eslint`, and the result's `findings.ids` holds its id

#### Scenario: All green

- **WHEN** `bdk check record <run-dir> round-2 --round 2` records every check with exit 0
- **THEN** no line is appended and `findings.ids` is empty

### Requirement: Errors of the check command

`bdk check plan` and `bdk check record` SHALL report these errors and write no file when one applies:

| Code | When | Exit |
| ---- | ---- | ---- |
| `usage/invalid-argument` | `<id>` is not kebab-case, a `--kind` value is unknown, an `--at` value is not `part`, `wave` or `review`, `--round` is not a positive integer, a `--scope` or `--tests` value is empty, git cannot resolve the `--changed` revision, an `--exit` value is not `<kind>-<tool>=<code>` with a code from 0 to 255, or an `--exit` or `--timed-out` key names no planned check or is given twice | 2 |
| `env/run-dir-missing` | `<run-dir>` is not an existing directory | 3 |
| `env/plan-missing` | `bdk check record` finds no `<run-dir>/checks/<id>/plan.json`, or one it cannot read; the hint names `bdk check plan` | 3 |
| `env/not-configured` | `bdk check plan` runs in a project that is not configured (spec `bdk-cli/config`, "Configured project"); the hint names `/bdk:setup` | 3 |
| `env/config-invalid` | `bdk check plan` finds a configuration problem; the hint names `bdk config check` | 3 |
| `env/git-missing` | `--changed` is given and git is not on `PATH` | 3 |
| `env/not-a-repo` | `--changed` is given and the project root is not inside a git work tree | 3 |

#### Scenario: Unknown kind

- **WHEN** `bdk check plan <run-dir> 02 --kind tests` runs
- **THEN** the CLI reports `usage/invalid-argument` naming `tests` and the kinds `test`, `lint` and `build`, writes no file, and exits 2

#### Scenario: Unknown point

- **WHEN** `bdk check plan <run-dir> 02 --at merge` runs
- **THEN** the CLI reports `usage/invalid-argument` naming `merge` and the points `part`, `wave` and `review`, writes no file, and exits 2

#### Scenario: Missing run directory

- **WHEN** `bdk check plan .bdk/runs/nope 02` runs and that directory does not exist
- **THEN** the CLI reports `env/run-dir-missing` naming the directory, writes no file, and exits 3

#### Scenario: Not configured

- **WHEN** `bdk check plan <run-dir> 02` runs in a project without `.bdk/settings.yaml`
- **THEN** the CLI reports `env/not-configured` with a hint to run `/bdk:setup`, and exits 3

#### Scenario: Record without a plan

- **WHEN** `bdk check record <run-dir> 07 --exit test-vitest=0` runs and `<run-dir>/checks/07/plan.json` does not exist
- **THEN** the CLI reports `env/plan-missing` with a hint to run `bdk check plan`, writes no file, and exits 3

#### Scenario: Unknown key

- **WHEN** the plan `02` holds `test vitest` and `bdk check record <run-dir> 02 --exit test-jest=0` runs
- **THEN** the CLI reports `usage/invalid-argument` naming `test-jest` and the planned keys, writes no file, and exits 2

### Requirement: Plan the checks

`bdk check plan <run-dir> <id> [--at <point>] [--changed <ref>] [--scope <path>]... [--tests <path>]... [--kind <kind>]...` SHALL resolve which of the project's configured check commands to run and how, and SHALL run none of them. `<run-dir>` is the run directory of a Change (by convention `.bdk/runs/<change>/`), relative to the working directory; it SHALL exist. `<id>` names the check and SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`); the caller picks it (a part id, `<part-id>-red`, `wave-1`, `round-2`), so parallel callers with different ids never share a file. `--at` takes `part`, `wave` or `review`. `--changed` takes a git revision. `--scope` and `--tests` are repeatable, one path per value, relative to the project root. `--kind` is repeatable and takes `test`, `lint` or `build`.

The command SHALL read the resolved configuration (spec `bdk-cli/config`) and select these entries, in this order, each kind in the order its items resolve: `tools.test`, then `tools.lint`, then `tools.build`; with `--kind`, only the kinds named; with `--at`, only the entries whose `when` holds that point or that have no `when`. An entry not selected SHALL NOT be planned and SHALL NOT be listed.

The run's files SHALL be the union of the `--scope` paths and, with `--changed <ref>`, the files git reports changed against `<ref>` in the project root: every tracked file that differs between `<ref>` and the working tree or the index, deleted files left out, renames counted as the new path, paths relative to the project root and limited to it (`git diff --name-only --relative --no-renames --diff-filter=d -z <ref>`), and every untracked file not ignored (`git ls-files --others --exclude-standard -z`); deduplicated and sorted by code unit. The picked tests SHALL be the `--tests` paths, deduplicated and sorted by code unit. A `tools.lint` or `tools.build` entry SHALL take the run's files. A `tools.test` entry SHALL take the picked tests when `--tests` is given, and the run's files otherwise. Without any of them, an entry has no files.

An entry's files SHALL be the files it takes that its `paths` match; all of them when the entry has no `paths`. A path SHALL match when it matches at least one glob of `paths` as a rule path matches a file (spec `bdk-cli/rules`, "Rules for a stage and files"): after a leading `./` is dropped, a glob's `*` does not cross `/`, `**` matches any number of directories, and dot files match like any other file. For each selected entry the command SHALL plan:

- an entry whose `command` holds `{files}`, when it has files: the command with every `{files}` replaced by the entry's files, separated by one space, each path left as is when it consists only of `A-Z a-z 0-9 _ . / @ % + = : , -` and otherwise quoted for the POSIX shell in single quotes;
- an entry whose `command` holds `{files}`, when it takes no file at all: nothing; the entry is skipped with the reason `no-files`;
- an entry whose `command` holds `{files}` or that has `paths`, when it takes files and none is the entry's: nothing; the entry is skipped with the reason `paths`;
- any other entry: its `command` as written, the whole project.

For each planned entry the command SHALL give the line to run, exactly `<command> </dev/null > <output> 2>&1`, where `<command>` is the planned command and `<output>` its output file (requirement "Output files"), written relative to the project root when it is inside it and absolute otherwise, quoted like a path of `{files}`; the line SHALL hold nothing else (no `cd`, no variable, no other command), so the permission rules of the project's commands apply to it. The command SHALL give each entry's Bash timeout in milliseconds: the entry's `timeout` (600 seconds without one) times 1000, but at most the value of the environment variable `BASH_MAX_TIMEOUT_MS` (600000 when it is unset or not a positive integer). It SHALL add a note to an entry whose `timeout` exceeds that cap, naming `env.BASH_MAX_TIMEOUT_MS` in `.claude/settings.json` and the value that covers the entry, and a note to an entry whose command holds `&&`, `||`, `;` or `|` outside quotes, saying that only its last part writes to the output file and that a project script keeps the command whole.

The command SHALL write the plan to `<run-dir>/checks/<id>/plan.json`, replacing an earlier one, as one JSON object followed by a newline, and `--json` SHALL print the same object. It SHALL hold `version` `1`, `id`, `at` (the point or `null`), `changed` (the revision as given or `null`), `scope` (the run's files or `null` when none), `tests` (the picked tests or `null` without `--tests`), `cwd` (the project root, the directory the configuration was resolved in), `checks` (one object per planned entry, in plan order: `kind`, `tool`, `command`, `scoped` (whether the entry's command held `{files}`), `timeout` in seconds, `bash-timeout` in milliseconds, `output` (the output path, `<run-dir>` joined as given), `line`, and `notes`, a list of strings), and `skipped` (one object `{"kind", "tool", "reason"}` per skipped entry, `reason` being `paths` or `no-files`). The command SHALL exit 0 whenever it writes a plan, also when nothing is planned.

#### Scenario: Plan prints the real command

- **WHEN** the configuration has the `tools.test` item `playwright-changed` with `command: "npm run test:e2e -- {files}"`, `paths: ["e2e/**/*.spec.ts"]` and `timeout: 900`, and `BASH_MAX_TIMEOUT_MS` is `1800000`, and `bdk check plan .bdk/runs/v3-1-x 02-red --at part --kind test --tests e2e/a.spec.ts` runs
- **THEN** it runs no command, writes `.bdk/runs/v3-1-x/checks/02-red/plan.json`, and prints the line `npm run test:e2e -- e2e/a.spec.ts </dev/null > .bdk/runs/v3-1-x/checks/02-red/test-playwright-changed.txt 2>&1` with the Bash timeout `900000`, and exits 0

#### Scenario: Timeout above the Bash cap

- **WHEN** the same item is planned with `BASH_MAX_TIMEOUT_MS` unset
- **THEN** its Bash timeout is `600000` and it carries a note naming `env.BASH_MAX_TIMEOUT_MS` and `900000`

#### Scenario: Picked tests go to test items, changed files to lint

- **WHEN** the configuration has the `tools.test` items `vitest-related` (`command: "pnpm vitest related --run {files}"`, `paths: ["src/**"]`) and `playwright-changed` (`command: "npm run test:e2e -- {files}"`, `paths: ["e2e/**/*.spec.ts"]`) and the `tools.lint` item `eslint-changed` (`command: "pnpm eslint {files}"`, `paths: ["**/*.ts"]`), `src/checkout.ts` is changed against `HEAD`, and `bdk check plan <run-dir> 03 --at part --changed HEAD --tests src/checkout.test.ts --tests e2e/checkout.spec.ts` runs
- **THEN** it plans `pnpm vitest related --run src/checkout.test.ts`, `npm run test:e2e -- e2e/checkout.spec.ts` and `pnpm eslint src/checkout.ts`, and `skipped` is empty

#### Scenario: No E2E spec picked

- **WHEN** the same configuration is planned with `--tests src/checkout.test.ts` only
- **THEN** `playwright-changed` is not planned and `skipped` lists it with the reason `paths`

#### Scenario: Tests take changed files without --tests

- **WHEN** `bdk check plan <run-dir> wave-1 --at wave --changed main` runs on the `tools.test` item `api` with `paths: ["api/**"]` and `command: "uv run pytest"`, and `api/app.py` changed against `main`
- **THEN** it plans `uv run pytest </dev/null > <run-dir>/checks/wave-1/test-api.txt 2>&1`

#### Scenario: Items of one point

- **WHEN** the configuration has the `tools.test` items `related` (`command: "vitest related --run {files}"`, `when: [part]`), `unit` (`command: "vitest run"`, `when: [wave, review]`) and `smoke` (`command: "node smoke.js"`, no `when`), and `bdk check plan <run-dir> wave-1 --at wave --changed main` runs with `src/a.ts` changed
- **THEN** it plans `vitest run` and `node smoke.js`, `related` is neither planned nor listed under `skipped`, and the plan's `at` is `wave` and `changed` is `main`

#### Scenario: Changed files from git

- **WHEN** against `HEAD` the working tree modifies `src/a.ts`, deletes `src/old.ts`, stages a new `src/c.ts`, and holds the untracked file `test/a.test.ts` and the ignored file `dist/a.js`, and `bdk check plan <run-dir> 02 --changed HEAD` runs on the `tools.lint` item `eslint` with `command: "eslint {files}"`
- **THEN** it plans `eslint src/a.ts src/c.ts test/a.test.ts`

#### Scenario: Unknown revision

- **WHEN** `bdk check plan <run-dir> 02 --changed no-such-branch` runs
- **THEN** the CLI reports `usage/invalid-argument` naming `no-such-branch`, writes no file, and exits 2

#### Scenario: Each entry gets only its files

- **WHEN** the configuration has the `tools.lint` items `ruff` with `paths: ["api/**"]` and `command: "uv run ruff check {files}"`, and `eslint` with `paths: ["web/**"]` and `command: "pnpm eslint {files}"`, and the plan runs with `--scope web/src/a.tsx --scope api/app.py --scope ./api/tests/test_app.py`
- **THEN** it plans `uv run ruff check ./api/tests/test_app.py api/app.py` and then `pnpm eslint web/src/a.tsx`, and `skipped` is empty

#### Scenario: Entry with paths and no files variant

- **WHEN** the `tools.lint` item `ruff` has `paths: ["**/*.py"]` and `command: "uv run ruff check ."`, and the run's files hold `api/app.py`
- **THEN** `ruff` is planned as `uv run ruff check .`; with files of only `web/src/a.tsx` it is skipped with the reason `paths`

#### Scenario: Paths ignored without files

- **WHEN** `bdk check plan <run-dir> full` runs without `--scope`, `--changed` and `--tests` on the items `eslint-changed` (`command: "eslint {files}"`) and `ruff` (`paths: ["**/*.py"]`, `command: "uv run ruff check ."`)
- **THEN** `ruff` is planned as not scoped and `eslint-changed` is skipped with the reason `no-files`

#### Scenario: Compound command

- **WHEN** the `tools.build` item `build` has `command: "pnpm codegen && pnpm build"`
- **THEN** its line is `pnpm codegen && pnpm build </dev/null > <output> 2>&1` and it carries a note that only the last part writes to the output file

#### Scenario: Path quoted for the shell

- **WHEN** the files of a `{files}` entry hold `src/a b.ts`, `src/it's.ts` and `src/a$&.ts`
- **THEN** `{files}` becomes `'src/a b.ts' 'src/a$&.ts' 'src/it'\''s.ts'`, character for character

#### Scenario: Nothing configured

- **WHEN** the configuration has no `tools.test`, `tools.lint` or `tools.build` item
- **THEN** the plan holds no check and no skipped entry, and the exit code is 0

### Requirement: Record the checks

`bdk check record <run-dir> <id> [--exit <kind>-<tool>=<code>]... [--timed-out <kind>-<tool>]... [--round <n>]` SHALL record the result of the checks of the plan `<run-dir>/checks/<id>/plan.json`, which the caller ran as their printed lines. `--exit` is repeatable and gives the exit code the Bash tool reported for one planned check, named by its kind and tool; `--timed-out` is repeatable and names a planned check whose Bash call the tool ended at its timeout. A key SHALL name a planned check, and SHALL be given at most once across both flags; a code SHALL be an integer from 0 to 255.

A check SHALL be `pass` when its exit code is 0, `fail` for any other code, `timeout` when it is named by `--timed-out`, and `not-run` when neither flag names it. The verdict SHALL be `fail` when any check is not `pass`, `none` when the plan holds no check, and `pass` otherwise. For each check with an exit code or a timeout, the command SHALL append the line `exit <code>` or `timeout <seconds>` to its output file unless the file already ends with such a line; it SHALL write nothing for a `not-run` check. The command SHALL write the result file in every case, print the result, and exit 1 when the verdict is `fail`, 0 otherwise; a red check is the answer "no" of spec `bdk-cli`, "Exit codes", not an error.

#### Scenario: Record the exit codes

- **WHEN** the plan `02` holds `test vitest` and `lint eslint`, and `bdk check record <run-dir> 02 --exit test-vitest=0 --exit lint-eslint=0` runs
- **THEN** it writes `<run-dir>/checks/02.json` with both checks `pass` and the verdict `pass`, each output file ends with the line `exit 0`, and it exits 0

#### Scenario: Red check

- **WHEN** the same plan is recorded with `--exit test-vitest=0 --exit lint-eslint=2`
- **THEN** `lint eslint` is `fail` with exit 2 and the last lines of its output, the verdict is `fail`, the result file is written, and the exit code is 1

#### Scenario: Timed out

- **WHEN** the plan's item `test playwright-changed` has `timeout: 900` and `bdk check record <run-dir> 02 --timed-out test-playwright-changed` runs
- **THEN** the check is `timeout`, its output file ends with the line `timeout 900`, and the exit code is 1

#### Scenario: A check nobody ran

- **WHEN** the plan `02` holds `test vitest` and `lint eslint`, and `bdk check record <run-dir> 02 --exit test-vitest=0` runs
- **THEN** `lint eslint` is `not-run`, the verdict is `fail`, and no line is appended to its output file

#### Scenario: Recorded twice

- **WHEN** `bdk check record <run-dir> 02 --exit test-vitest=1` runs twice
- **THEN** the output file of `test vitest` ends with exactly one `exit 1` line

#### Scenario: Nothing planned

- **WHEN** the plan `02` holds no check and `bdk check record <run-dir> 02` runs
- **THEN** the verdict is `none`, the result file is written with no check, and the exit code is 0

### Requirement: Plan text output

In text mode `bdk check plan` SHALL print a first line naming the id, the number of checks to run and skipped, and the instruction to run each line below as its own Bash call from the project root, one after another; then, when the run has `--at` or `--changed`, a line naming the point and the revision; then per planned check, in plan order, a line with its number, kind, tool, `scoped` or `full`, the project root and its Bash timeout, followed by its line, indented, and each of its notes, indented; then one `skip` line per skipped entry with its kind and tool and its reason (no file it takes matches its `paths`, or no files for its `{files}`); then the `bdk check record <run-dir> <id>` command with one `--exit <kind>-<tool>=<code>` per planned check, and the path of the plan file.

#### Scenario: Text of a plan

- **WHEN** `bdk check plan <run-dir> 02 --tests web/src/a.test.tsx` plans `test web` and skips the `tools.test` item `api`
- **THEN** stdout holds the line of `test web` indented under its header, a `skip` line naming `test api` and that no file it takes matches its `paths`, and `bdk check record <run-dir> 02 --exit test-web=<code>`

#### Scenario: Text of an empty plan

- **WHEN** nothing is planned
- **THEN** stdout says that no check is configured for this run and names `bdk check record <run-dir> <id>`

### Requirement: Record text output

In text mode `bdk check record` SHALL print, when the plan has `--at` or `--changed`, a first line naming the point and the revision; then one line per check in plan order with its status, kind, tool, `scoped` or `full`, and output path; under each check that is `fail` or `timeout`, its tail, each line indented, followed, when the tail holds the full 20 lines, by one indented line saying that these are the last 20 lines and the whole output is in the output file; under each `not-run` check, an indented line saying that no exit code was given for it; one `skip` line per skipped entry of the plan with its reason; then the verdict with the count of red checks, the path of the result file and, with `--round`, the number of findings appended and the log path.

#### Scenario: Text of a red record

- **WHEN** `bdk check record <run-dir> 02 --exit lint-eslint=1` records a failing lint check
- **THEN** stdout holds a `fail` line for the lint check followed by its indented tail, then `verdict: fail` and the result file path, and the exit code is 1

#### Scenario: Cut tail

- **WHEN** a red test check printed 57 lines of output
- **THEN** stdout holds its last 20 lines indented under the `fail` line, followed by the indented line `(last 20 lines; the whole output is in the file above)`; a red check whose output has fewer than 20 lines gets no such line
