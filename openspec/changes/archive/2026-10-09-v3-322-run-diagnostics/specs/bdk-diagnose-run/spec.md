## Purpose

Defines `/bdk:diagnose-run`, the read-only block of the `bdk` plugin that analyses a finished BDK run on the agent `bdk:analyst` - stages, agents, time, tokens, cost, retries, blockers and waste - from the run files of a Change and the host transcripts of its sessions, and writes one report in which every claim cites a file and line.

## ADDED Requirements

### Requirement: Skill and agent

The `bdk` plugin SHALL ship the skill `diagnose-run` (`skills/diagnose-run/`, the user command `/bdk:diagnose-run [<change> | <session-id>] [--transcripts <dir>]`) and the agent `bdk:analyst` (`agents/analyst.md`, default model `sonnet`, tools `Read`, `Grep`, `Glob`, `Bash`, `Write` and `Skill`, without `Agent` and `Edit`). When the skill runs anywhere but on `bdk:analyst`, it SHALL start `bdk:analyst` with the `Agent` tool, a prompt naming the skill `bdk:diagnose-run` and the same arguments, and `model` and `effort` from `models.analyst` as spec `bdk-cli/config` ("Every agent is a models role") says; it SHALL wait for it, reply with the agent's summary line and report path, and analyse nothing itself.

#### Scenario: Typed by a user

- **WHEN** a user types `/bdk:diagnose-run fix-total-crash`
- **THEN** one `Agent` call with `subagent_type: "bdk:analyst"` runs the skill, and the main thread reads no transcript

### Requirement: Inputs

The analyst SHALL take the Change from the first argument when `.bdk/runs/<it>/` exists; a first argument that is a session id SHALL name that session and the Change its transcript names. Without an argument it SHALL take `current` of `.bdk/runs/run.json`, else the only Change directory under `.bdk/runs/`; with several and no way to choose, it SHALL name them and stop without writing. It SHALL get the numbers from `bdk diagnostics report` (spec `bdk-cli/diagnostics`), passing `--transcripts` when given, and SHALL read the run files under `.bdk/runs/<change>/` itself.

#### Scenario: Copied transcripts

- **WHEN** the user runs `/bdk:diagnose-run fix-total-crash --transcripts .git/bdk-eval/transcripts`
- **THEN** the analyst runs `bdk diagnostics report fix-total-crash --transcripts .git/bdk-eval/transcripts`

### Requirement: Read only

The analyst SHALL write exactly one file, the report, and SHALL change no project file, run file or transcript. It SHALL run only commands that read. The report SHALL quote no code, command output or secret from a transcript: it names the event and cites it.

#### Scenario: One file written

- **WHEN** `/bdk:diagnose-run fix-total-crash` ends
- **THEN** the only new or changed file in the project is `.bdk/runs/fix-total-crash/diagnostics.md`

### Requirement: Report

The report SHALL be `.bdk/runs/<change>/diagnostics.md` (for a session that names no Change, `.bdk/runs/diagnostics/<session-id>.md`), replacing an earlier one. It SHALL start with `# Run diagnostics: <change>`, the sessions with their times, and the host cost or `unknown`, followed by the sections `## Summary`, `## Timeline` (one row per stage: skill, start, wall time, agents, tokens, cost), `## Agents` (one row per agent: id, type, stage, wall time, turns, tokens, cost, transcript or `missing`), `## Waste` (each finding with what it cost, a citation and where its fix belongs: a BDK skill or agent, the plan, or the project's configuration), `## Retries and blockers` (from the run files: verifier passes that failed, parts with more than one attempt or blocked, review rounds with blockers), `## What went well` and `## Missing data`. Every row and bullet SHALL carry a `<path>:<line>` citation that resolves: a transcript path relative to the transcripts directory, or a run file relative to the project root. An empty section SHALL hold `- None.` A cost the command reports as unknown SHALL be written as unknown, never estimated.

#### Scenario: Recorded fixture run

- **WHEN** `/bdk:diagnose-run fix-total-crash --transcripts .git/bdk-eval/transcripts` runs on the recorded `/bdk:debug` run of the eval fixture
- **THEN** the report lists the stages `diagnose-bug`, `commit`, `execute` and `auto-review` in that order, every agent of the session with its tokens and cost, the host cost of the session, and each waste finding the command reports with a citation that resolves

#### Scenario: One agent transcript missing

- **WHEN** one subagent transcript of the recorded run is removed
- **THEN** the report names that agent as missing under `## Agents` and `## Missing data`, and still lists every other agent with its tokens and cost

### Requirement: Reply

The skill SHALL reply with one line `Diagnostics: <wall time> wall, <cost>, <n> waste findings` and the report path.

#### Scenario: Reply

- **WHEN** the report is written
- **THEN** the reply names `.bdk/runs/fix-total-crash/diagnostics.md`
