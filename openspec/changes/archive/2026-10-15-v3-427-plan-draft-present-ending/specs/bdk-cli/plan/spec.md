## ADDED Requirements

### Requirement: Present scenarios

For every part the command SHALL read the scenarios under the heading `## Acceptance scenarios`: each list item that holds `Scenario: `, its name the text after the last `Scenario: `, and present when the item ends with ` (behaviour present)`, which is not part of the name. It SHALL read the `Verified by:` lines under `## Tasks`: each list item that starts with `Verified by:`, outside fenced code blocks; a task may hold several.

A scenario marked present SHALL be a `present-scenario` problem of its part, naming the scenario, unless a `Verified by:` line of the part holds its name as whole words and ends with `; it passes at its first run, the behaviour is present`, trailing spaces ignored. A scenario of the part that is not marked SHALL be a `present-scenario` problem naming it when a line with that ending holds its name as whole words in the text before the line's first `; `, after the names of the present scenarios and the code spans are taken out. A `present-scenario` problem SHALL NOT take a part's wave.

#### Scenario: Present scenario with its own line

- **WHEN** part `02` lists `Broken book (behaviour present)` and `Add an expense`, and its task has one `Verified by:` line naming `Add an expense` and the test file, and one naming `Broken book` with its test and ending `; it passes at its first run, the behaviour is present`
- **THEN** the result holds no `present-scenario` problem

#### Scenario: Ending missing on a shared line

- **WHEN** part `02` lists `Bad amount (behaviour present)`, and the only `Verified by:` line naming it reads `scenarios Add an expense, Bad amount; test/cli.test.js`
- **THEN** the result holds a `present-scenario` problem of part `02` naming `Bad amount`, and part `02` keeps its wave

#### Scenario: Ending in the middle of the line

- **WHEN** the only `Verified by:` line naming the present scenario `Unknown command` reads `Unknown command (it passes at its first run, the behaviour is present); test/cli.test.js`
- **THEN** the result holds a `present-scenario` problem of that part naming `Unknown command`

#### Scenario: Unmarked scenario on a line with the ending

- **WHEN** a `Verified by:` line reads `Scenario: Empty ledger and Scenario: Count flag; a test that expects Total: 0.00; it passes at its first run, the behaviour is present`, `Empty ledger` is marked present and `Count flag` and `Total` are not
- **THEN** the result holds one `present-scenario` problem, naming `Count flag`

## MODIFIED Requirements

### Requirement: Check output

The text output SHALL be, in this order:

1. A summary line `plan: <n> parts, <w> waves, ok` without problems, or `plan: <n> parts, <w> waves, <p> problems` with them (`part`, `wave`, `problem` in the singular for one).
2. `waves:` followed by one line `  <wave>: <ids separated by spaces>` per wave, or `waves: none` when no part has a wave.
3. `parts:` followed by one line per part: its id, `tasks <n>/<limit>`, `files <n>/<limit>`, `bytes <n>/<limit>`, `wave <wave>` (`-` without one) and `depends-on <ids separated by commas>` (`-` when empty).
4. Only with problems: `problems:` followed by one line per problem: its check, the part ids it names separated by commas (left out when it names none), a colon and its message.

Problems SHALL be ordered by check in the order `no-parts`, `name`, `frontmatter`, `no-tasks`, `max-tasks`, `max-files`, `max-bytes`, `present-scenario`, `unknown-dependency`, `cycle`, and within a check by their first part id, then their message.

`--json` SHALL print one object: `ok` (true when there is no problem), `limits` (`maxTasks`, `maxFiles`, `maxBytes`), `parts` (each `id`, `dependsOn`, `tasks`, `files`, `bytes`, `wave` or null, in id order), `waves` (each `wave` and its `parts`, in wave order) and `problems` (each `check`, `parts` and `message`, in the order above).

#### Scenario: Text a model reads

- **WHEN** a plan has part `01` without dependencies and part `02` with 6 tasks depending on `01`, under default limits
- **THEN** stdout starts with `plan: 2 parts, 2 waves, 1 problem`, lists `  1: 01` and `  2: 02` under `waves:`, and ends with a `problems:` line that starts with `  max-tasks 02:`

#### Scenario: JSON result

- **WHEN** `bdk plan check <dir> --json` runs on a plan with a cycle
- **THEN** stdout is one JSON object with `ok` false, the `limits`, the `parts`, the `waves` and a `problems` entry with `check` `cycle` and the part ids of the cycle in `parts`, and the exit code is 1

#### Scenario: Stable output

- **WHEN** `bdk plan check <dir>` runs twice on unchanged files
- **THEN** both runs print byte-identical stdout
