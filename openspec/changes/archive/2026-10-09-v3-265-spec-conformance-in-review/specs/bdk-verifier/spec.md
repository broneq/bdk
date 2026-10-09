## MODIFIED Requirements

### Requirement: Verifier agent

The `bdk` plugin SHALL ship the agent `bdk:verifier` (`agents/verifier.md`) with the default model `opus` and the tools `Read`, `Grep`, `Glob`, `Write`, `Bash` and `Skill`. A caller SHALL start it with the `Agent` tool and a prompt that names the verifier skill to run and its arguments; the agent SHALL run that skill with the `Skill` tool, so the caller can continue the same agent with `SendMessage` for a later iteration.

The agent SHALL check and never fix: it SHALL change no file except the one report its skill names, and SHALL run only commands that read, with one exception: when its skill tells it to append its problems to a review round's findings log, it SHALL do so only with `bdk findings add` on that log.

The agent SHALL run each command as a Bash command of its own, with nothing before or after it (no `cd`, `;`, `&&`, `|` or `echo`), and SHALL read and list files with `Read`, `Glob` and `Grep` rather than through Bash, so that a narrow grant such as `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)` matches its calls. A denied or failed command SHALL NOT be reported as a problem of the artifact: when a command its skill needs is still denied when run on its own, the agent SHALL write no report and SHALL return the command and its denial instead of a verdict.

#### Scenario: Started for a plan

- **WHEN** a caller starts `bdk:verifier` with the prompt to run `bdk:verify-plan` for Change `add-csv-export`
- **THEN** the agent runs the skill `bdk:verify-plan` with that Change, writes only `.bdk/runs/add-csv-export/plan/verify-N.md`, and returns its verdict line and the report path

#### Scenario: Continued for the next iteration

- **WHEN** the caller sends the same agent a message after the plan was fixed
- **THEN** the agent checks the plan again and writes the next report `verify-N+1.md`, leaving the earlier report unchanged

#### Scenario: Under a narrow Bash grant

- **WHEN** the run grants Bash only as `Bash(*/bin/bdk *)` and the agent runs `bdk:verify-plan`
- **THEN** none of its tool calls is denied and its report holds the output of `bdk plan check`

#### Scenario: Command denied

- **WHEN** the agent's `bdk plan check` call is denied although it is the whole Bash command
- **THEN** the agent writes no report and returns the denied command, and no `Must address` item names the denial

#### Scenario: Findings of a review round

- **WHEN** a round lead starts the agent to run `bdk:spec-conformance` with `--round <round dir>` and the report has two `Must address` items
- **THEN** the agent writes `<round dir>/spec-conformance.md`, appends two findings to `<round dir>/findings.jsonl` with `bdk findings add`, and changes no other file
