# bdk-verifier Specification

## Purpose

Defines the `bdk:verifier` agent that the `bdk` plugin ships and the report every verifier block writes, so `verify-design`, `verify-plan` and `spec-conformance` check alike and their callers read one format.

## Requirements

### Requirement: Verifier agent

The `bdk` plugin SHALL ship the agent `bdk:verifier` (`agents/verifier.md`) with the default model `opus` and the tools `Read`, `Grep`, `Glob`, `Write`, `Bash` and `Skill`. A caller SHALL start it with the `Agent` tool and a prompt that names the verifier skill to run and its arguments; the agent SHALL run that skill with the `Skill` tool, so the caller can continue the same agent with `SendMessage` for a later iteration.

The agent SHALL check and never fix: it SHALL change no file except the one report its skill names, and SHALL run only commands that read.

#### Scenario: Started for a plan

- **WHEN** a caller starts `bdk:verifier` with the prompt to run `bdk:verify-plan` for Change `add-csv-export`
- **THEN** the agent runs the skill `bdk:verify-plan` with that Change, writes only `.bdk/runs/add-csv-export/plan/verify-N.md`, and returns its verdict line and the report path

#### Scenario: Continued for the next iteration

- **WHEN** the caller sends the same agent a message after the plan was fixed
- **THEN** the agent checks the plan again and writes the next report `verify-N+1.md`, leaving the earlier report unchanged

### Requirement: Verifier report body

A verifier report SHALL start with the line `Verdict: PASS` or `Verdict: FAIL`, followed by the sections `## Must address`, `## Should consider` and `## Checked`, in this order. The verdict SHALL be `FAIL` if and only if `Must address` holds at least one item.

Each item of `Must address` SHALL start with an ID `M<n>` and each item of `Should consider` with an ID `S<n>`, followed by where the problem is and what it is. Every `Must address` item SHALL carry evidence on a line `Evidence:`: a file and line, a spec scenario, or a command and its output. `Checked` SHALL list what the verifier checked and found to hold. An empty section SHALL hold the line `- None.`

#### Scenario: Failing report

- **WHEN** a verifier finds one problem that makes the artifact wrong and one improvement
- **THEN** its report starts with `Verdict: FAIL`, `Must address` holds `M1` with an `Evidence:` line, and `Should consider` holds `S1`

#### Scenario: Passing report

- **WHEN** a verifier finds nothing that makes the artifact wrong
- **THEN** its report starts with `Verdict: PASS`, and `Must address` holds `- None.`

### Requirement: Stable item IDs across iterations

A verifier report after the first of the same artifact SHALL read the previous report of that artifact. It SHALL keep the ID of every problem that is still open, SHALL give a new problem the next unused number of its section, and SHALL list the IDs it found fixed on a line `Closed: <IDs>` directly under the verdict line (`Closed: none` when none was fixed).

#### Scenario: One problem fixed, one left

- **WHEN** `verify-1.md` holds `M1` and `M2`, the plan fixed `M1`, and the verifier finds a new problem
- **THEN** `verify-2.md` holds `Closed: M1`, keeps `M2`, and names the new problem `M3`
