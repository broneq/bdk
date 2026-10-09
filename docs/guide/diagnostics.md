# Diagnostics - where a run's time and money went

After a run, `/bdk:diagnose-run` tells you how it went: which stages and agents ran, how long each took, what each cost, what was retried or blocked, and what wasted time or tokens. Every claim in its report cites a transcript or run file line, so you can check it, and each waste finding names where its fix belongs: a BDK skill or agent, the plan, or your project's configuration.

Nothing is recorded while a run works. The analysis reads, after the fact, what Claude Code already keeps: the transcripts of your sessions under `~/.claude/projects/` and the run files under `.bdk/runs/<change>/`. A run pays nothing for being diagnosable.

## Run it

```text
/bdk:diagnose-run fix-total-crash
```

The argument is the Change, or a session id. Without one it takes the current Change of the autopilot run. The skill starts the agent `bdk:analyst` (sonnet; set another with `models.analyst.model`), which finds every session that worked on the Change, reads the run files, and writes `.bdk/runs/<change>/diagnostics.md`. It replies with one line, for example `Diagnostics: 14m00s wall, $1.78, 2 waste findings`, and the report path.

Transcripts copied elsewhere, for example from another machine, or out of reach of a sandbox that denies reading `~/.claude`: `/bdk:diagnose-run fix-total-crash --transcripts <dir>`.

## The report

| Section | What it holds |
|---|---|
| header | the sessions with their times, and the host's cost of them |
| `## Summary` | what ran, how long, what it cost, the largest waste |
| `## Timeline` | one row per stage: skill, start, wall time, agents, tokens, cost |
| `## Agents` | one row per agent: type, stage, wall time, turns, tokens, cost, transcript |
| `## Waste` | each finding with what it cost, a citation, and where its fix belongs |
| `## Retries and blockers` | failed verifier passes, part attempts, review rounds with blockers, from the run files |
| `## What went well` | what to keep |
| `## Missing data` | what could not be counted, and why |

The report quotes no code, command output or secret from a transcript; it names the event and cites its line.

## Where the numbers come from

`bdk diagnostics report <change>` counts; the analyst reads and judges. You can run the command yourself for the raw numbers (`--json` for a script):

- **Time** from the transcript timestamps. A stage runs from one `Skill` call of the main conversation to the next.
- **Tokens** per agent and model from the usage of each request, counted once per request.
- **Cost** from Claude Code itself: the `cost-state` it writes when a session ends. A stage's or agent's cost is its share of that, weighted by token kind. BDK keeps no price table. A session that has not ended, or crashed, has no `cost-state`, and its cost is reported as unknown.
- **Waste** from detectors over each agent's tool calls:

| Detector | Flags |
|---|---|
| `repeat-bash` | the same Bash command run again by one agent with no edit in between |
| `repeat-read` | one file read three times or more by one agent with no write to it in between |
| `repeat-skill` | one skill loaded twice by one agent |
| `retry-after-error` | a call repeated with the same input after it failed |
| `refused` | a call refused by the permission system, a hook or the user |
| `timeout` | a call that timed out |
| `slow-call` | a tool call that held its agent two minutes or more (waiting for another agent does not count) |
| `outlier` | an agent three times slower than the median of three or more agents of its type |
| `missing-transcript` | an agent whose transcript Claude Code did not keep |

A detector finding is a lead, not a verdict: a second `mktemp -d` is not waste, a second `npm test` after nothing changed is. The analyst checks each one against the transcript before it goes under `## Waste`.

An agent whose transcript is missing is listed as missing; every other agent still counts. Its share of the host cost then lands on the agents counted, and the report says so.

## Related

- [Cost and footprint](./footprint.md) - what drives the spend, and the settings that change it.
- [`bdk diagnostics report`](/reference/bdk/cli#diagnostics-report) in the CLI reference.
