## MODIFIED Requirements

### Requirement: Check run text output

In text mode the command SHALL print, when the run has `--at` or `--changed`, a first line naming the point and the revision; then one line per check in run order with its status, kind, tool, `scoped` or `full`, and output path; under each check that is not `pass`, its tail, each line indented, followed, when the tail holds the full 20 lines, by one indented line saying that these are the last 20 lines and the whole output is in the output file; one `skip` line per skipped entry with its kind and tool and its reason (no changed file matches its `paths`, or no files for its `{files}`); then the verdict with the count of red checks, the path of the result file and, with `--round`, the number of findings appended and the log path.

#### Scenario: Text of a red run

- **WHEN** `bdk check run <run-dir> 02` runs and the lint check fails
- **THEN** stdout holds a `fail` line for the lint check followed by its indented tail, then `verdict: fail` and the result file path, and the exit code is 1

#### Scenario: Text of a skipped entry

- **WHEN** `bdk check run <run-dir> 02 --scope web/src/a.tsx` skips the `tools.test` item `api`
- **THEN** stdout holds a `skip` line naming `test api` and that no changed file matches its `paths`

#### Scenario: Cut tail

- **WHEN** a red test check prints 57 lines of output
- **THEN** stdout holds its last 20 lines indented under the `fail` line, followed by the indented line `(last 20 lines; the whole output is in the file above)`; a red check whose output has fewer than 20 lines gets no such line
