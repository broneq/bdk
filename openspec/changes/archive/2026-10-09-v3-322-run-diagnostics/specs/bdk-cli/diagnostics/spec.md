## Purpose

Defines `bdk diagnostics report`, the read-only command that counts the sessions of a BDK run from Claude Code's transcripts - stages, agents, wall time, turns, tokens, each agent's share of the host's cost, and the findings of deterministic waste detectors with citations - so `/bdk:diagnose-run` never sums transcripts by hand.

## ADDED Requirements

### Requirement: Report command

`bdk diagnostics report [<change>] [--session <id>]... [--transcripts <dir>]` SHALL read the transcripts directory and count the sessions selected there. It SHALL write no file, SHALL NOT call git, GitHub or the network, and SHALL exit 0 whenever it can read the transcripts directory, whatever it finds. Without a Change and without `--session` it SHALL fail with `usage/no-run` and exit 2; a Change name that does not match `^[a-z0-9][a-z0-9-]*$` SHALL fail with `usage/invalid-change`.

#### Scenario: Nothing named

- **WHEN** `bdk diagnostics report` runs with no argument and no `--session`
- **THEN** it prints `usage/no-run` on stderr and exits 2

#### Scenario: Read only

- **WHEN** `bdk diagnostics report add-total` runs in a project
- **THEN** no file in the project or the transcripts directory is created or changed

### Requirement: Transcripts directory

The transcripts directory SHALL be `--transcripts <dir>`, resolved against the working directory, when given; otherwise `<config>/projects/<key>`, where `<config>` is `$CLAUDE_CONFIG_DIR` when set and not empty, else `~/.claude`, and `<key>` is the absolute working directory with every character other than an ASCII letter or digit replaced by `-`. When that directory does not exist the command SHALL fail with `env/no-transcripts`, name the directory, and exit 3; when it or a file in it cannot be read for lack of permission (a sandbox), the command SHALL fail with `env/transcripts-unreadable`, name the directory, and exit 3.

#### Scenario: Default directory

- **WHEN** `bdk diagnostics report add-total` runs in `/Users/me/my_app` without `CLAUDE_CONFIG_DIR`
- **THEN** it reads `~/.claude/projects/-Users-me-my-app`

#### Scenario: Copied transcripts

- **WHEN** `bdk diagnostics report fix-total-crash --transcripts .git/bdk-eval/transcripts` runs
- **THEN** it reads `<project>/.git/bdk-eval/transcripts` and prints that path on its first line

#### Scenario: Directory the sandbox denies

- **WHEN** the command runs where reading `~/.claude/projects/<key>` fails with `EPERM`
- **THEN** it exits 3 with `env/transcripts-unreadable` naming the directory, not an internal error

### Requirement: Sessions of a Change

A session SHALL be a file `<session-id>.jsonl` (a UUID) in the transcripts directory, with its subagents in `<session-id>/subagents/agent-<id>.jsonl` and `agent-<id>.meta.json`. With a Change, the command SHALL count every session whose main transcript names `.bdk/runs/<change>` or `openspec/changes/<change>` (also under `archive/<date>-`) not followed by a letter, digit or `-`. Each `--session <id>` SHALL add that session; an id without a transcript SHALL be a warning, not a failure. With a Change and no matching session the result SHALL hold no session and a warning naming the directory. Sessions SHALL be listed by start time.

#### Scenario: Only the Change's sessions

- **WHEN** the directory holds a session that reads `.bdk/runs/add-total/state.json` and one that never names `add-total`
- **THEN** `bdk diagnostics report add-total` counts the first session only

#### Scenario: Longer name

- **WHEN** a session names only `openspec/changes/add-total-2/`
- **THEN** `bdk diagnostics report add-total` does not count it

### Requirement: Counts

For each session the command SHALL report, from the transcripts alone:

- the session's start and end (first line of the main transcript, last line of any of its transcripts) and wall time;
- each agent: the main thread as `main`, and each subagent with its `agentType` and `description` from its meta file (else from the `Agent` call), the agent whose `Agent` call started it and that call's `<file>:<line>`, its stage, start, end, wall time, turns (requests), tool calls, failed tool results, and tokens per model (input, output, cache read, cache write 5 minutes and 1 hour);
- each stage: a `Skill` call of the main thread, from that call to the next `Skill` call of the main thread or the session's end, with its skill, `<file>:<line>`, wall time, the agents that started in it, and its tokens (the main thread's requests in it plus those agents');
- per model, the session's tokens.

A request that spans several lines with the same `requestId` SHALL be counted once, with the usage of its last line. A line that is not JSON or not of a shape the parser knows SHALL be counted and reported as a warning per file, never guessed at.

#### Scenario: Stage timeline

- **WHEN** the main thread calls `Skill` with `bdk:diagnose-bug`, then `bdk:commit`, `bdk:execute` and `bdk:auto-review`
- **THEN** the report lists four stages in that order, each with its start, wall time and the `<file>:<line>` of its `Skill` call, and the `bdk:lead` started during `bdk:execute` belongs to stage 3

#### Scenario: Streamed request

- **WHEN** two lines of one request carry usages with 21 and 287 output tokens
- **THEN** the request counts 287 output tokens and one turn

### Requirement: Cost share

The session's cost SHALL be the host's: the last `cost-state` line of the main transcript (`totalCostUSD`, `modelUsage.<model>.costUSD`, a model suffix such as `[1m]` ignored). An agent's cost SHALL be, for each model it used, its share of that model's host cost by weighted tokens - input 1, output 5, cache read 0.1, cache write 5 minutes 1.25, cache write 1 hour 2 - summed over its models; a stage's cost SHALL be the same share of its tokens. Without a `cost-state` line, or for a model the host's cost does not name, the cost SHALL be unknown (`null`, `$?` in text) and the tokens SHALL still be reported. The command SHALL hold no price table.

#### Scenario: Shares add up

- **WHEN** a session's `cost-state` says `claude-sonnet-5-5` cost $2.00 and every agent used only that model
- **THEN** the agents' costs add up to $2.00

#### Scenario: Live session

- **WHEN** the main transcript has no `cost-state` line
- **THEN** the session, its agents and its stages are reported with their tokens, their cost is unknown, and a warning says the session had not ended or crashed

### Requirement: Partial transcripts per agent

An agent whose transcript is missing, unreadable or empty, or an `Agent` call that no subagent meta file names, SHALL be reported as that agent alone with `state: missing`, its type and description from the `Agent` call or meta file, and the `<file>:<line>` of the call; its tokens and cost SHALL be unknown, and every other agent, stage and the session's totals SHALL still be counted (#157). Because the host cost covers the missing agent too, the result SHALL warn that its share is spread over the agents counted.

#### Scenario: One transcript removed

- **WHEN** one subagent's `.jsonl` of a session is removed and its meta file kept
- **THEN** the report lists that agent as missing with the line of the `Agent` call that started it, a `missing-transcript` finding, and every other agent with its tokens and cost, and warns that the missing agent's share of the host cost is spread over the others

### Requirement: Detectors

The command SHALL run these detectors on each agent's transcript and on the session's agents, each finding naming its detector, the agent and its type, a count, a summary that quotes no tool output, and up to five `<file>:<line>` citations relative to the transcripts directory:

| Detector | Reports |
|---|---|
| `repeat-bash` | A Bash command run again by one agent with no `Edit`, `Write`, `NotebookEdit` or `MultiEdit` of that agent in between; cites each repeat |
| `repeat-read` | One file, offset and limit read 3 times or more by one agent with no write to that file in between; cites each read |
| `repeat-skill` | One skill loaded twice or more by one agent; cites each load after the first |
| `retry-after-error` | A tool call repeated with the same input after that call failed, until one succeeds; cites each retry |
| `refused` | A tool call the permission system, a hook or the user refused; cites each result |
| `timeout` | A tool result saying the call timed out; cites each result |
| `slow-call` | A tool call other than `Agent` whose result came 2 minutes or more after the call; cites the call and the result |
| `outlier` | An agent whose wall time is 3 times the median of its type or more, with 3 agents of the type or more |
| `missing-transcript` | An agent without a readable transcript; cites the `Agent` call |

The thresholds SHALL be constants of the command, not settings.

#### Scenario: Repeated command

- **WHEN** an agent runs `pnpm test` twice with no edit in between, edits a file, and runs it again
- **THEN** one `repeat-bash` finding cites the line of the second run only

#### Scenario: Citation resolves

- **WHEN** a finding cites `<session>/subagents/agent-<id>.jsonl:<n>`
- **THEN** line `<n>` of that file under the transcripts directory is the tool call or result the finding describes

### Requirement: Report output

The text output SHALL start with `transcripts: <dir>`, then `change: <change|->  sessions: <n>`, then per session a header line (id, start, end, wall time, host cost or `cost unknown`, main transcript file), the per-model lines, the stage lines, the agent lines and the finding lines, each with its citation, and last the warnings. `--json` SHALL print one document `{transcripts, change, sessions: [{id, file, start, end, wallMs, cost, models, stages, agents, findings}], warnings}` with the fields named above.

#### Scenario: JSON

- **WHEN** `bdk diagnostics report add-total --json` runs
- **THEN** stdout is one JSON document whose `sessions[0].agents[0].id` is `main`
