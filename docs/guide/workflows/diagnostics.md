# Diagnostics

BDK records every session so you can find out afterwards what went wrong: a command refused again and again, a task redispatched, a whole test suite run where one test was enough, a file read ten times. Three layers build on each other:

1. **The run journal** is always on. Every kernel command and hook event appends one line to `.bdk/.machine/telemetry/journal.jsonl`: the command, its exit code and refusal rule, the agent, and a pointer to the host transcript, never its content.
2. **The verbose log** is opt-in. It adds a live line per tool call while the session runs and a full render of the session when it ends.
3. **`/bdk:diagnose`** is run by hand. It reads the report, the journal, the ledger and bounded transcript slices, and writes a cited analysis.

Everything lives under `.bdk/.machine/`, which git ignores. The verbose log and the analysis may hold project code and secrets that tools printed.

## Turn on the verbose log

```bash
bdk config set diagnostics.verbose true --local
```

`--local` writes the key to `.bdk/settings.local.yaml`, so it stays on your machine. The setting applies from the next session: `hooks session-start` creates the marker `.bdk/.machine/verbose`, and removes it again when the setting is off or the settings do not resolve. With the marker, every tool call starts the kernel for its live line, which adds roughly 50 to 100 ms per call. Turn it off when you no longer need it.

## Where the files are

| File                                              | Written                                                      | Holds                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.bdk/.machine/telemetry/journal.jsonl`           | Always                                                       | One JSON line per kernel command and hook event; at most 1 MiB, the oldest half dropped past it                                                               |
| `.bdk/.machine/logs/<session>.live.log`           | With the marker, at every tool call                          | Local time, agent, tool, input on one line, `ok` or the error, and the first 3 lines of the output                                                            |
| `.bdk/.machine/logs/<change>-<session>.log`       | With the marker, at session end; or by `bdk diagnostics log` | The render of the whole session: every transcript event in time order, indented by agent, with the journal lines and the findings in between, then the counts |
| `.bdk/.machine/diagnostics/<change>-<session>.md` | By `/bdk:diagnose`                                           | The analysis                                                                                                                                                  |

Each log file is at most 20 MiB, and the logs directory keeps the 20 newest files.

## Read the live log and the render

Follow a running session with `tail -f .bdk/.machine/logs/<session>.live.log`. The live log holds no model text and no thinking; it is a quick view of the tool calls.

The render is the full picture. A finding appears as a line starting with `!` right after the event it cites:

```
15:04:47 main Bash echo probe-repeat
15:04:47 main result probe-repeat
! D1 main main:40  Bash command run 2 times with no edit between: echo probe-repeat
```

Tool results are cut to 20 lines, except the output of a kernel command, which is kept whole. `bdk diagnostics log --full` keeps every line. You can render any session in the journal, with or without the verbose setting, as long as its transcripts are still on the machine:

```bash
bdk diagnostics log --session <session-id>
```

## The report

`bdk diagnostics report` counts a session without a model: refusals by rule and role, guard blocks, retries, escalations, parks and questions, tokens per agent, task and part, and the session's cost in USD. `--stage <stage>` narrows it to one stage skill. It also runs eight detectors:

| Detector | Reports                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| D1       | The same Bash command run again by one agent with no edit in between; kernel calls are left to D2 and D3       |
| D2       | A refused kernel command repeated with the same arguments                                                      |
| D3       | One refusal rule seen `diagnostics.repeat-refusal` times or more                                               |
| D4       | A whole-suite test command run by an agent that holds a task                                                   |
| D5       | One file read `diagnostics.repeat-read` times or more by one agent with no write in between                    |
| D6       | A redispatch, narrowing, escalation or park, with its reason from the ledger                                   |
| D7       | The same skill or role contract loaded twice in one agent                                                      |
| D8       | A task far above the session median (`diagnostics.outlier-factor`), or a kernel command slower than its budget |

Each finding has a citation: `journal:<line>`, `<agent-id>:<line>` of a transcript, or a ledger id. `bdk diagnostics slice <cite>` prints the transcript events around it.

The thresholds are settings:

| Key                          | Default | Range             |
| ---------------------------- | ------- | ----------------- |
| `diagnostics.verbose`        | `false` | `true` or `false` |
| `diagnostics.repeat-refusal` | `3`     | 2 to 50           |
| `diagnostics.repeat-read`    | `3`     | 2 to 50           |
| `diagnostics.outlier-factor` | `3`     | 1.5 to 20         |

## Run `/bdk:diagnose`

```
/bdk:diagnose [<session-id>]
```

Without a session id it takes the latest session of the active Change, or the latest session. It runs in a separate read-only agent, so the transcripts never fill your own session. It writes five sections:

- `## Summary`, `## What went well`, `## What went wrong`: what happened, with a citation for every claim;
- `## Where the fix belongs`: for each problem, the stage skill, role contract, dispatch package, kernel, plan or project. Run inside the BDK repository, it also proposes the sentence to change;
- `## For a BDK issue`: the BDK problems in words.

A problem of your project is also recorded as a `learning` entry of the active Change, so the next run can use it.

## Attach the analysis to a BDK issue

Copy only `## For a BDK issue` into the issue. The kernel checks that section before it stores the analysis: no fenced code block, no code span other than BDK names (commands, rule ids, tickets, roles, settings keys, `/bdk:` skills, paths under `.bdk/`), and no line equal to a line of a file in your repository. The check catches quoted code, not everything private, so read the section before you paste it.

Attach the BDK version from the render's header (`bdk:` and `host:` lines) as well.
