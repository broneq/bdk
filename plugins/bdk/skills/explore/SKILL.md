---
name: explore
description: 'Maps the code an OpenSpec Change touches - modules, entry points, data, boundaries, conventions, tests and gaps, each with file:line - into the run file design/explore.md, on the bdk:explorer agent. Use when a Change is about to be designed, when asked what code a proposal touches, or when /bdk:design needs the code map.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git log *) Bash(git show *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Explore

When the block above says "BDK not configured: run /bdk:setup", stop: reply with that line and write nothing.

## 0. Run as `bdk:explorer`

This block runs on the `bdk:explorer` agent, whose instructions start with "You are `bdk:explorer`". When you are not that agent (a user typed the command in the main conversation), do not map the code yourself: start the agent with the Agent tool, `subagent_type: "bdk:explorer"`, prompt `Run the skill bdk:explore with the arguments: <the arguments above>`, wait for it, reply with its answer, and stop. Keep its agent ID: a follow-up question goes to the same agent with `SendMessage`.

Done when you are `bdk:explorer`, or the agent has answered.

## 1. Find the Change

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found, ask which Change to map, and stop.

Read `openspec/changes/<change>/proposal.md` whole. Done when you know the Change and what it adds or changes.

## 2. Map the code

Start from the nouns of the proposal: Grep for them, then read the files that define them. Follow callers and callees one level out, and stop there. Read the tests of the code you read, and the manifest that names the test command. Read excerpts, not whole trees; a map takes minutes, not an hour.

Note for every fact the file and line you saw it at. Done when you can say, for each change the proposal lists, which code it touches or that no code exists for it yet.

## 3. Write the map

Write `.bdk/runs/<change>/design/explore.md` (create the directories) with exactly these sections:

```markdown
# Explore: <change>

## Touches
- `src/store.js:12` `listEntries({ from, to })` returns the entries of a range; the export reads it.

## Patterns
- <a convention the change must follow, with the file:line that shows it>

## Tests
- <test command and where the touched code is tested, with file:line>

## Gaps
- <what the proposal needs that the code does not have>

## Unsure
- <what you could not settle from the code; "None." when nothing>
```

Every bullet of `Touches`, `Patterns` and `Tests` names `file:line`. Write facts, not a design: no approach, no recommendation. Keep it under 80 lines. Done when the file has the five sections.

## 4. Reply

Reply with the path of the map and at most three lines: how many places it touches, the main gap, the main unsure point.

## Follow-up questions

When continued with a question, answer it from the code as in step 2 and append to the map a section `## Follow-up <n>` (n counts from 1) holding the answer with `file:line`. Leave the earlier sections as they are. Reply with the section's heading and a one-line answer.
