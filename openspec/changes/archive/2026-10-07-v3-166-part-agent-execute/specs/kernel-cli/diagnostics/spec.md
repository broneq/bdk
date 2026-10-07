## MODIFIED Requirements

### Requirement: bdk diagnostics write

Stores the analysis of one session, after checking its BDK issue section for project code. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk diagnostics write [--session <session-id>]` with the Markdown on stdin
- **Availability:** `agent`
- **Mode:** `command`
- **Owner:** T47
- **Slice:** `diagnostics`
- **Arguments:**
  - `--session <session-id>`. As for `bdk diagnostics report`; it names the file.
- **Behaviour:** Reads the Markdown from stdin, which must deliver its first byte within 3 seconds (`kernel-cli`, Invocation; #166). It requires the headings `## Summary`, `## What went well`, `## What went wrong`, `## Where the fix belongs` and `## For a BDK issue`; a missing heading is `input/invalid-argument` naming it. It checks the `## For a BDK issue` section only: no fenced code block; every code span is a `bdk` command, a rule id of the catalogue, a ticket or ledger id, a role or adapter name, a settings key, a BDK skill name or a path under `.bdk/` or `${CLAUDE_PLUGIN_ROOT}`; and no line of 20 or more characters, trimmed, equals a line of a file git tracks. A failed check refuses with `policy/project-code` naming the section line and the check, and writes nothing. On success it writes `.bdk/.machine/diagnostics/<change>-<session>.md` (`<session>.md` without a Change), replacing an earlier analysis of the session, and prints the path.
- **Writes:** `.bdk/.machine/diagnostics/`
- **Output:** `schema/cli/output/diagnostics-write.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/stdin-unavailable`, `policy/project-code`; plus the common rules of every command.
- **Example:**

  ```bash
  bdk diagnostics write --json < analysis.md
  ```

  ```json
  { "path": ".bdk/.machine/diagnostics/2026-10-05-italian-5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11.md" }
  ```

#### Scenario: analysis stored

- **WHEN** the Markdown has the five headings, quotes project code under `## What went wrong`, and its issue section names only `policy/missing-evidence`, `bdk attempt close` and role `lead`
- **THEN** the exit code is 0 and the file holds the whole Markdown, the project code included

#### Scenario: policy/project-code

- **WHEN** a line of the `## For a BDK issue` section, trimmed, equals a 34-character line of a tracked source file
- **THEN** the exit code is 2 with `rule: policy/project-code` naming the section line and the equal-line check, and no file is written

#### Scenario: fenced block in the issue section

- **WHEN** the `## For a BDK issue` section holds a fenced code block
- **THEN** the exit code is 2 with `rule: policy/project-code` naming the fenced-block check

#### Scenario: missing heading

- **WHEN** the Markdown has no `## For a BDK issue` heading
- **THEN** the exit code is 3 with `rule: input/invalid-argument` naming the heading

#### Scenario: input/stdin-unavailable

- **WHEN** `bdk diagnostics write` runs from a shell whose stdin is a pipe that never closes and no byte arrives
- **THEN** the exit code is 3 within 4 seconds, the error object carries `rule: input/stdin-unavailable`, and nothing is written
