## ADDED Requirements

### Requirement: Run journal

The kernel SHALL keep a run journal at `.bdk/.machine/telemetry/journal.jsonl`: one JSON object per line, appended by the kernel commands (`kernel-cli`, Run journal) and the hooks (`kernel-cli/hooks`, Run journal and verbose lines), never committed, and never larger than 1 MiB.

Every line carries `v: 1`, `kind` (`command`, `guard`, `session`, `agent-start`, `agent-stop`, `question`) and `at`; the other fields per kind are those of the two requirements named above, and `schema/state/journal-line.json` fixes them. A line is at most 4 KiB; a longer value is cut. The journal holds pointers to host transcripts (`transcript` paths), never transcript content, tool output or file content; the only free text it holds is command arguments cut to 200 characters. When an append makes the file reach 1 MiB, the oldest half of its lines is dropped under the `.bdk/.machine` lock, so a reader never sees a cut line. A project root without `.bdk/` gets no journal: the kernel never creates `.bdk/` to write one. Commands run in a part worktree write the journal of the home checkout, as the agent registry does.

#### Scenario: line schema

- **WHEN** an E2E test validates every line an execute run leaves in the journal against `schema/state/journal-line.json`
- **THEN** each line validates and none holds a key outside its kind

#### Scenario: bounded on a long run

- **WHEN** a test appends 20 000 `command` lines of 250 bytes to the journal
- **THEN** the file is below 1 MiB after every append, every line in it parses, and the newest line is the last appended

#### Scenario: parallel appends stay whole

- **WHEN** eight processes append 500 lines each at the same time
- **THEN** every line of the journal parses as JSON

#### Scenario: no .bdk directory

- **WHEN** `bdk version` runs in a git repository without `.bdk/`
- **THEN** no `.bdk/` directory is created

### Requirement: Verbose log

While `.bdk/.machine/verbose` exists, the kernel SHALL write a live log per session at `.bdk/.machine/logs/<session>.live.log`, and the render of a session SHALL be written to `.bdk/.machine/logs/<change>-<session>.log` (`<session>.log` without a Change); both are plain text, never committed, and may hold project content.

Each log file is at most 20 MiB; past it, the oldest half of its lines is dropped. The directory keeps the 20 newest files by modification time; writing a file removes older ones beyond that. `.bdk/.machine/verbose` is an empty file that only `hooks session-start` creates and removes (`kernel-cli/hooks`, Run journal and verbose lines).

#### Scenario: log files capped

- **WHEN** a twenty-first log file is written
- **THEN** `.bdk/.machine/logs/` holds the 20 newest files

#### Scenario: logs never tracked

- **WHEN** a session with verbose on ends in the fixture repository
- **THEN** `git status --porcelain` lists nothing under `.bdk/.machine/`

### Requirement: Diagnostics analysis file

An analysis stored by `bdk diagnostics write` SHALL live at `.bdk/.machine/diagnostics/<change>-<session>.md` (`<session>.md` without a Change), one file per session, replaced on a new write and never committed.

The file holds the five sections of `kernel-cli/diagnostics`, bdk diagnostics write. Only its `## For a BDK issue` section is guaranteed free of project code; the user attaches that section, or the file after reading it, to an issue in the BDK repository. Nothing sends the file anywhere.

#### Scenario: analysis replaced

- **WHEN** `bdk diagnostics write` runs twice for one session
- **THEN** one file exists for the session and it holds the second Markdown
