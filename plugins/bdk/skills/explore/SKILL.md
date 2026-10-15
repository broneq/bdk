---
name: explore
description: 'Maps the code an OpenSpec Change touches - modules, entry points, data, boundaries, conventions, tests and gaps, each with file:line - into the run file explore/design.md, on the bdk:explorer agent. Use when a Change is about to be designed, when asked what code a proposal touches, or when /bdk:design needs the code map.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git log *) Bash(git show *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Explore

When the block above says "BDK not configured: run /bdk:setup", stop: reply with that line and write nothing.

## 0. Run as `bdk:explorer`

This block runs on the `bdk:explorer` agent, whose instructions start with "You are `bdk:explorer`". When you are not that agent (a user typed the command in the main conversation), do not map the code yourself: start the agent with the Agent tool in the foreground (`run_in_background: false`), `subagent_type: "bdk:explorer"`, prompt `Run the skill bdk:explore with the arguments: <the arguments above>`, `model` set to `models.explorer.model` and `effort` set to `models.explorer.effort`, each only when the configuration above sets it; wait for it, reply with its answer, and stop. Keep its agent ID: a follow-up question goes to the same agent with `SendMessage`.

Done when you are `bdk:explorer`, or the agent has answered.

## 1. Find the Change

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found, ask which Change to map, and stop.

Read `openspec/changes/<change>/proposal.md` whole. When `.bdk/runs/<change>/explore/propose-recon.md` exists, read it too: its facts about the acceptance criteria are settled, so do not check them again; build on them. Done when you know the Change and what it adds or changes.

## 2. Map the code

Start from the nouns of the proposal: Grep for them, then read the files that define them. Follow callers and callees one level out, and stop there. Read the tests of the code you read, and the manifest that names the test command; follow that command to the script it runs and the test runner's setup files. Read the project's rules for the commands the Change will run: `CLAUDE.md` or `AGENTS.md`, the hooks of `.claude/settings.json` and the scripts they call, and the docs that say how to build, test or run the project. A hook, a wrapper or a setup step that changes how a command runs goes under `Patterns` or `Gaps` with its `file:line`. Read files with `Read`, `Grep` and `Glob`, not with Bash. Read excerpts, not whole trees; a map takes minutes, not an hour.

When the proposal relies on a command-line tool (the project's own or an installed one) and its options or output matter, run its help: `<tool> --help`, `<tool> <subcommand> --help` or `<tool> --version`, the tool called the way the project calls it (`node bin/upload.js --help`). Run it from the project root as a Bash command of its own, with the tool's path exactly as the project writes it: no `cd`, no absolute path, nothing chained before or after it; permission rules match a command as written, so another form of it is asked about or denied. Its output settles the point: write it under `Touches` or `Gaps` with the command as the evidence, never under `Unsure`. Run nothing else of the tool.

Note for every fact the file and line you saw it at. Done when you can say, for each change the proposal lists, which code it touches or that no code exists for it yet.

## 3. Write the map

Write `.bdk/runs/<change>/explore/design.md` (create the directories): a front matter, then exactly these sections. The orchestrator builds `explore/index.md` from the front matter, so fill each field.

```markdown
---
question: What code does <change> touch?
summary: <one line: the main places it touches and the main gap>
stage: design
files: [<every project file you read for the map>]
---
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
- <what you could not settle from the code or a help command; for a tool, the help command that would settle it and why it did not run; "None." when nothing>
```

Every bullet of `Touches`, `Patterns` and `Tests` names `file:line`, or the help command for a tool's options. Write facts, not a design: no approach, no recommendation. Keep it under 80 lines. Done when the file has the front matter and the five sections.

## 4. Reply

Reply with the path of the map and at most three lines: how many places it touches, the main gap, the main unsure point.

## Follow-up questions

When continued with a question, answer it from the code as in step 2 and append to the map a section `## Follow-up <n>` (n counts from 1) holding the answer with `file:line`. Leave the earlier sections as they are. Reply with the section's heading and a one-line answer.
