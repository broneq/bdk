# kernel-cli/diagnostics Specification

## Purpose

Run diagnostics commands (`diagnostics`). They read the run journal (`kernel-state`, Run journal) and the host transcripts it points to. They compute a deterministic report of one session, render the session as a verbose text log, cut bounded transcript excerpts for the `/bdk:diagnose` analyzer, and store its analysis after checking that the part meant for a BDK issue holds no project code. No command starts a model.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`. No command of this group is Change-scoped. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/project-code",
  "why": "line 41 of section For a BDK issue equals line 12 of src/i18n/languages.ts",
  "instead": [
    "describe the line in words instead of quoting it",
    "move the quote to a section above For a BDK issue"
  ]
}
```

## Requirements

### Requirement: bdk diagnostics report

The deterministic report of one session: metrics, detector findings and attribution. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk diagnostics report [--session <session-id>] [--stage <stage>]`
- **Availability:** `read`
- **Mode:** `command`
- **Owner:** T47
- **Slice:** `diagnostics`
- **Arguments:**
  - `--session <session-id>`. The host session to report on. Without it: the session of the latest `session` journal line of the active Change, or the latest session in the journal when no Change is active.
  - `--stage <stage>`. Only the part of the session from the stage skill's `ctx skill <stage>` line to the next stage skill's line.
- **Behaviour:** Reads `.bdk/.machine/telemetry/journal.jsonl`, the agent registry, the ledger of the Change the journal lines name, and the transcripts named by the session's `session` and `agent-stop` lines. It attributes each `command` line to an agent: first through the registry row that holds the line's ticket, then through the transcript `tool_use` whose Bash command names the same verb and arguments within 5 seconds before the line's time. A line of a host hook (`hooks …`) counts under `host`, and a `guard` line under the agent it names. A line it cannot attribute counts under `unknown`. It counts refusals by rule and by role, guard blocks, retries (a second ticket on one target), escalations, parks, questions, and the wall time and tokens per agent, task and part, with tokens split by model into `input`, `output`, `cacheRead` and `cacheWrite`. Usage that repeats under one `requestId` counts once. `cost` holds `totalUSD` and `byModel` from the last `cost-state` line of the main transcript; it always covers the whole session, also with `--stage`, and it is `null` when that line is absent or of an unknown shape. It runs detectors D1 to D8 (`kernel-settings`, Keys of run diagnostics) and lists each finding with `detector`, `agent`, `ticket`, `at`, `cite` and `summary`. A finding never quotes tool output. `anomalies` is the number of findings. `transcript` is `ok`, `missing` (a named file is gone), `unreadable` (more than 10% of its lines are of an unknown shape; `unknownLines` holds the count in every state) or `unavailable` (the host gave no transcript path). Fields that need a transcript are `null` when it is not `ok`. `truncated` is true when the journal no longer holds the session's first line. Text mode prints the counts, then one line per finding.
- **Writes:** nothing
- **Output:** `schema/cli/output/diagnostics-report.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk diagnostics report --stage execute --json
  ```

  ```json
  {
    "session": "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11",
    "change": "2026-10-05-italian",
    "stage": "execute",
    "from": "2026-10-05T14:02:11.004Z",
    "to": "2026-10-05T14:20:51.871Z",
    "transcript": "ok",
    "unknownLines": 0,
    "truncated": false,
    "refusals": { "total": 7, "byRule": { "policy/missing-evidence": 3, "input/invalid-envelope": 2, "policy/ticket-open": 2 }, "byRole": { "main": 3, "implementer": 2, "lead": 2 } },
    "guardBlocks": 0,
    "retries": 2,
    "escalations": 0,
    "parks": 0,
    "questions": 1,
    "agents": [ { "agent": "a3f9", "type": "bdk:worker", "role": "implementer", "wallMs": 398000, "tokens": { "claude-sonnet-5": { "input": 2100, "output": 3050, "cacheRead": 36100, "cacheWrite": 4200 } } } ],
    "tasks": [ { "task": "01-1", "part": "01", "tickets": 2, "wallMs": 412000, "tokens": { "claude-sonnet-5": { "input": 2100, "output": 3050, "cacheRead": 36100, "cacheWrite": 4200 } } } ],
    "parts": [ { "part": "01", "wallMs": 690000, "tokens": { "claude-sonnet-5": { "input": 2100, "output": 3050, "cacheRead": 36100, "cacheWrite": 4200 } } } ],
    "tokensUnknownAgents": 0,
    "cost": { "totalUSD": 1.92, "byModel": { "claude-sonnet-5": 1.41, "claude-haiku-4-5-20251001": 0.51 } },
    "findings": [ { "detector": "D3", "agent": "main", "ticket": "A-k2m4", "at": "2026-10-05T14:03:40.120Z", "cite": "journal:1184", "summary": "policy/missing-evidence refused 3 times" } ],
    "anomalies": 1
  }
  ```

#### Scenario: refusals counted from the journal

- **WHEN** the journal holds, for one session, three `command` lines with `rule: policy/missing-evidence` and two with `rule: input/invalid-envelope`, and `bdk diagnostics report --session <id> --json` runs
- **THEN** the exit code is 0, `refusals.byRule` is `{"policy/missing-evidence": 3, "input/invalid-envelope": 2}` and `refusals.total` is 5, whether or not the transcripts exist

#### Scenario: role attribution through the ticket

- **WHEN** a refused `command` line carries ticket `A-k2m4`, and the registry row of agent `a3f9` of type `bdk:worker` holds `A-k2m4` with a package of role `implementer`
- **THEN** the refusal counts under `byRole.implementer`

#### Scenario: transcript missing

- **WHEN** the `agent-stop` line of agent `a3f9` names a transcript file that no longer exists
- **THEN** `transcript` is `missing`, the tokens of `a3f9` are `null`, `tokensUnknownAgents` counts it, and the refusal counts are unchanged

#### Scenario: session cost from the transcript

- **WHEN** the main transcript of the session ends with a `cost-state` line whose `totalCostUSD` is `0.086` and whose `modelUsage` names one model with `costUSD` `0.086`, and `bdk diagnostics report --stage execute --json` runs
- **THEN** `cost` is `{"totalUSD": 0.086, "byModel": {"<model>": 0.086}}` for the whole session, and a transcript without a `cost-state` line gives `cost: null`

#### Scenario: detector over its threshold

- **WHEN** `diagnostics.repeat-refusal` is `3` and one rule is refused three times in the session
- **THEN** `findings` holds one `D3` finding whose `cite` names a journal line, and `anomalies` is at least 1

#### Scenario: truncated journal

- **WHEN** the halving of the journal dropped the session's first lines
- **THEN** `truncated` is true and the report still counts the lines that remain

#### Scenario: input/not-found

- **WHEN** `bdk diagnostics report --session 00000000-0000-0000-0000-000000000000` runs and the journal has no line of that session
- **THEN** the exit code is 3 with `rule: input/not-found` naming the session id and `instead` naming `bdk diagnostics report` without `--session`

### Requirement: bdk diagnostics log

The verbose render of one session into a text file. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk diagnostics log [--session <session-id>] [--full]`
- **Availability:** `agent`
- **Mode:** `command`
- **Owner:** T47
- **Slice:** `diagnostics`
- **Arguments:**
  - `--session <session-id>`. As for `bdk diagnostics report`.
  - `--full`. Print skill, role-contract and tool-result text whole instead of collapsed.
- **Behaviour:** Writes `.bdk/.machine/logs/<change>-<session>.log`, or `<session>.log` without a Change, replacing an earlier render of the same session. It does not need `diagnostics.verbose`. The file starts with a header naming the Change, the stage, the start time, the BDK version and commit, and the host version. Events of the main and the subagent transcripts follow in time order, one per line, indented by agent depth, each with the time, the agent id and type. The events are: a skill or role contract loaded (its first 20 lines), a BDK injection (`ctx skill`, `ctx startup`), a tool call (input on one line), a tool result (the first 20 lines; kernel stdout whole), the model's text, an agent start and stop with tokens, and each `command` and `guard` journal line with its exit code and `rule`. Thinking is never written. After the event that triggered it, each detector finding of `bdk diagnostics report` is written as a line starting with `!`. The file ends with the report's counts. When `transcript` is not `ok`, the file holds the journal lines only and says why in the header. Text mode prints the path; `--json` prints the path, the line count and `transcript`.
- **Writes:** `.bdk/.machine/logs/`
- **Output:** `schema/cli/output/diagnostics-log.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command.
- **Example:**

  ```bash
  bdk diagnostics log --json
  ```

  ```json
  { "path": ".bdk/.machine/logs/2026-10-05-italian-5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11.log", "lines": 1840, "transcript": "ok" }
  ```

#### Scenario: render of a recorded session

- **WHEN** `bdk diagnostics log --session <id>` runs over the recorded transcript fixture and its journal
- **THEN** the file lists the role contract the worker loaded, every kernel call with its exit code, the model's text, a `!` line for each finding of the report, and no thinking block

#### Scenario: render without transcripts

- **WHEN** the transcripts of the session are gone
- **THEN** the exit code is 0, the header states `transcript: missing`, and the file lists the journal lines of the session

#### Scenario: input/not-found

- **WHEN** `bdk diagnostics log --session <id>` names a session the journal does not know
- **THEN** the exit code is 3 with `rule: input/not-found`

### Requirement: bdk diagnostics slice

One bounded excerpt of a session's transcript, for an analyzer that must not read a whole transcript. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk diagnostics slice <cite> [--before <n>] [--after <n>] [--session <session-id>]`
- **Availability:** `read`
- **Mode:** `command`
- **Owner:** T47
- **Slice:** `diagnostics`
- **Arguments:**
  - `<cite>` (required). A `cite` value of a report finding: `journal:<line>`, `<agent-id>:<line>` (a transcript line of that agent, `main` for the main thread) or a ledger entry id.
  - `--before <n>`, `--after <n>`. Events before and after the cited one; default 10 each. The two together are at most 100.
  - `--session <session-id>`. As for `bdk diagnostics report`.
- **Behaviour:** Resolves the cite to one point in time and one agent, and prints that agent's transcript events around it in the event format of `bdk diagnostics log`. Tool results are cut to 20 lines. The output is never more than 200 lines; past that it ends with a line naming how many lines it left out. A ledger id resolves to the entry's time and the agent that wrote it (`--ticket` holder). Thinking is never printed.
- **Writes:** nothing
- **Output:** `schema/cli/output/diagnostics-slice.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command.
- **Example:**

  ```bash
  bdk diagnostics slice journal:1184 --before 5 --after 5 --json
  ```

  ```json
  { "agent": "main", "at": "2026-10-05T14:03:40.120Z", "events": ["14:03:39 main Bash bdk attempt close A-k2m4 ok --json", "14:03:40 main result exit 2 refused: policy/missing-evidence"], "omitted": 0 }
  ```

#### Scenario: slice bounded

- **WHEN** `bdk diagnostics slice main:900 --before 100 --after 100` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument` naming the limit of 100

#### Scenario: slice of a journal line

- **WHEN** `bdk diagnostics slice journal:1184` runs and line 1184 is a refused `command` line attributed to `main`
- **THEN** the events are the main transcript's events around the matching `tool_use`, at most 200 lines

#### Scenario: input/not-found

- **WHEN** the cite names a journal line past the end of the journal or an agent with no transcript
- **THEN** the exit code is 3 with `rule: input/not-found` naming the cite

### Requirement: bdk diagnostics write

Stores the analysis of one session, after checking its BDK issue section for project code. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk diagnostics write [--session <session-id>]` with the Markdown on stdin
- **Availability:** `agent`
- **Mode:** `command`
- **Owner:** T47
- **Slice:** `diagnostics`
- **Arguments:**
  - `--session <session-id>`. As for `bdk diagnostics report`; it names the file.
- **Behaviour:** Reads the Markdown from stdin. It requires the headings `## Summary`, `## What went well`, `## What went wrong`, `## Where the fix belongs` and `## For a BDK issue`; a missing heading is `input/invalid-argument` naming it. It checks the `## For a BDK issue` section only: no fenced code block; every code span is a `bdk` command, a rule id of the catalogue, a ticket or ledger id, a role or adapter name, a settings key, a BDK skill name or a path under `.bdk/` or `${CLAUDE_PLUGIN_ROOT}`; and no line of 20 or more characters, trimmed, equals a line of a file git tracks. A failed check refuses with `policy/project-code` naming the section line and the check, and writes nothing. On success it writes `.bdk/.machine/diagnostics/<change>-<session>.md` (`<session>.md` without a Change), replacing an earlier analysis of the session, and prints the path.
- **Writes:** `.bdk/.machine/diagnostics/`
- **Output:** `schema/cli/output/diagnostics-write.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/project-code`; plus the common rules of every command.
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
