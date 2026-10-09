---
name: diagnose-run
description: 'Analyses how a BDK run went, after the fact, on the bdk:analyst agent - which stages and agents ran, how long each took, its tokens and cost, retries and blockers, and where time and tokens were wasted (repeated commands, re-reads, refused or slow calls, outliers) - from the run files under .bdk/runs/<change>/ and the host transcripts of its sessions, and writes .bdk/runs/<change>/diagnostics.md with a citation for every claim. Use when the user asks why a run was slow or expensive, what a run cost, what went wrong in a run, or wants a diagnostics report or post-mortem of a Change, a session or /bdk:run.'
argument-hint: "[<change> | <session-id>] [--transcripts <dir>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Diagnose a run

Find out, after a run, where its time and money went and what wasted them, and write it down with a citation for every claim, so a user or a BDK maintainer can act on it without reading the transcripts. You read; you never change the project, the run files or the transcripts. The only shell command you run is `bdk`, alone in its call (no `cd`, `ls` or `;` around it); read and list files with `Read`, `Glob` and `Grep`, which need no permission.

## 0. Run as `bdk:analyst`

Transcripts are large; reading them fills a context. This block runs on the `bdk:analyst` agent, whose instructions start with "You are `bdk:analyst`". When you are not that agent (a user typed the command, or another skill invoked it in the main thread), do not analyse anything yourself: start the agent with the Agent tool, `subagent_type: "bdk:analyst"`, prompt `Run the skill bdk:diagnose-run with the arguments: <arguments>`, where the arguments are those above plus a Change, session id or transcripts directory the user named in the request and the arguments lack (a directory as `--transcripts <dir>`): the agent sees only its prompt, `model` set to `models.analyst.model` and `effort` set to `models.analyst.effort`, each only when the configuration above sets it; wait for it, reply with its summary line and report path, and stop.

Done when you are `bdk:analyst`, or the agent has answered.

## 1. Find the run

The Change is the first argument when `.bdk/runs/<it>/` exists. A first argument that is a session id (a UUID) names one session; pass it as `--session <id>` below, and its Change is the one the command's sessions name under `.bdk/runs/`, if any. Without an argument, take `current` of `.bdk/runs/run.json`, else the only Change directory under `.bdk/runs/`; with several and no way to choose, name them and stop without writing.

Done when you know the Change (or the session) and its run directory `.bdk/runs/<change>/`.

## 2. Count with `bdk diagnostics report`

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" diagnostics report <change>`, adding `--session <id>` for a session id and `--transcripts <dir>` when the arguments give one. It finds every session of the Change in Claude Code's transcripts and prints, with a `<file>:<line>` citation for each:

- per session: start, end, wall time, and the host's cost (`cost-state`), or `$?` when the session had not ended;
- per model, per stage (one per `Skill` call of the main conversation) and per agent: wall time, turns, tool calls, errors, tokens, and the cost share;
- waste findings of its detectors (`repeat-bash`, `repeat-read`, `repeat-skill`, `retry-after-error`, `refused`, `timeout`, `slow-call`, `outlier`, `missing-transcript`);
- warnings: lines of an unknown shape, a missing `cost-state`, agents without a transcript.

Take every number from this output; do not count transcripts yourself. A cost share is the agent's or stage's part of the host's cost, weighted by token kind; say so once in the report. Exit 3 means the transcripts directory is missing or not readable (the error names it): write the report from the run files alone, and say under `## Missing data` where the command looked and that copying the transcripts elsewhere and passing `--transcripts <dir>` gets the numbers.

Done when you have the command's output.

## 3. Read the run files

Read `.bdk/runs/<change>/`: the stage results (`debug/result.md`, `design/verify-N.md`, `plan/verify-N.md`, `execute/result.md`, `execute/part-NN.md`, `execute/conform-NN.md`, `review/result.md`, `review/round-N/review.md`, `close/*.md`), `state.json` (part attempts, blocked reasons) and `checks/*.json` (check verdicts). They say which verifier passes failed, which parts took more than one attempt and why, which review rounds held blockers, and which checks failed.

Done when you know the retries and blockers of the run, each with its file and line.

## 4. Judge the waste

A detector finding is a lead, not a verdict. For each one, read the cited lines of the transcript (`Read` with `offset` and `limit`; a transcript line is one JSON object, a tool call's result is on a later line with the same `tool_use_id`) and decide:

- **Waste**: time or tokens spent for nothing, for example the same check run again with nothing changed, an agent polling for minutes for results its tool call would have returned, a refused call the agent then worked around. Say what it cost (the wall time of a slow call, the turns of the repeats) and where the fix belongs: a BDK skill or agent (name it), the plan, or the project's configuration (a permission rule, a tool command).
- **Not waste**: a repeat that is meant to differ (`mktemp -d`, a poll that ends at once, a re-read after another agent wrote the file). Leave it out of `## Waste` and do not count it.

A finding whose lines you did not read is not written. The `errors` the command counts per agent are tool results with `"is_error":true`; `Grep` the agent's transcript for that to find their lines, and judge them the same way: an expected failure (the red run of a test-first part) is not waste.

Add waste the detectors cannot see only with a citation, for example a stage that redid what an earlier stage had settled, or a part attempt that failed for a reason the plan could have prevented.

Done when every finding is judged.

## 5. Write the report

Write `.bdk/runs/<change>/diagnostics.md` (for a session that names no Change, `.bdk/runs/diagnostics/<session-id>.md`), replacing an earlier one:

```markdown
# Run diagnostics: fix-total-crash

Sessions: 5b5dc3b8-239a-482b-8610-40a4e7734d05 (2026-10-09 14:02 - 14:31, 29m00s)
Cost: $3.12 (host); stage and agent costs are shares of it by weighted tokens

## Summary
<three to five lines: what ran, how long, what it cost, the largest waste and what it cost>

## Timeline
| Stage | Start | Wall | Agents | Tokens (in / out / cache read / cache write) | Cost | Cite |
|---|---|---|---|---|---|---|

## Agents
| Agent | Type | Stage | Wall | Turns | Tokens (in / out / cache read / cache write) | Cost | Transcript |
|---|---|---|---|---|---|---|---|

## Waste
- W1 <what was wasted and what it cost>. Cite: <file>:<line>. Fix: <where it belongs>.

## Retries and blockers
- <a failed verifier pass, a part attempt, a review blocker, a failed check>. Cite: <file>:<line>.

## What went well
- <one line each>. Cite: <file>:<line>.

## Missing data
- None.
```

- One `## Agents` row per agent the command lists, the main conversation included, with its full id. An agent the command reports missing gets `missing` in the Transcript column, unknown tokens and cost, and a line under `## Missing data` naming it and the line of the `Agent` call that started it; the command's warning about its share of the cost goes there too.
- A citation is `<path>:<line>`: a transcript path relative to the transcripts directory, as the command prints it, or a run file relative to the project root. Every row and bullet has one; a number you could not cite is not written.
- A cost the command prints as `$?` is `unknown`; never estimate it.
- Never quote code, command output or a secret from a transcript: name the event and cite it.
- An empty section holds `- None.`

## 6. Reply

Reply with one line, `Diagnostics: <wall> wall, <cost>, <n> waste findings`, where `<n>` counts the bullets under `## Waste`, and the report path.
