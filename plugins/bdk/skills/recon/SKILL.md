---
name: recon
description: 'Checks the conditional or unclear acceptance criteria of a BDK proposal against the code - does the condition hold, does a named symbol or file exist, how many copies of a thing exist - and writes the facts with file:line, no recommendation, to explore/propose-recon.md, on the bdk:explorer agent. Use when /bdk:propose names AC to check before its decision round, or when asked whether a condition of a proposal holds in the code.'
argument-hint: "<change-name> <AC ids>"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git log *) Bash(git show *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Recon

When the block above says "BDK not configured: run /bdk:setup", stop: reply with that line and write nothing.

You settle facts, not decisions: the user decides from what you write, so write what the code shows and nothing about what to do.

## 0. Run as `bdk:explorer`

This block runs on the `bdk:explorer` agent, whose instructions start with "You are `bdk:explorer`". When you are not that agent, do not read the code yourself: start the agent with the Agent tool in the foreground (`run_in_background: false`), `subagent_type: "bdk:explorer"`, prompt `Run the skill bdk:recon with the arguments: <the arguments above>`, `model` set to `models.explorer.model` and `effort` set to `models.explorer.effort`, each only when the configuration above sets it; wait for it, reply with its answer, and stop.

Done when you are `bdk:explorer`, or the agent has answered.

## 1. Read the AC

The first argument names the Change; the rest are AC ids (`AC-2 AC-3`). Without ids, take every AC of `## Acceptance` that holds a condition on the code or names a symbol, file or count. Read `openspec/changes/<change>/proposal.md` (`## Intent`, `## Acceptance`) and `.bdk/runs/<change>/source/issue.md` when it exists.

For each AC, write down the factual questions it raises: the condition to test ("can the seed helper mark an entry void"), each symbol or file it names, each "the", "every" or "all" whose count matters.

Done when every named AC has its questions.

## 2. Settle each question from the code

Grep for the nouns of the question, read the files that define them and their signatures, and stop when the question is settled. Read with Read, Grep and Glob, not with Bash. When the AC relies on a command-line tool's options, run its help (`<tool> --help`) as a Bash command of its own from the project root, the tool's path as the project writes it.

For each question note what the code shows, with `file:line` (or the help command), and whether that settles it. Do not map the rest of the code, propose an approach, name reuse candidates or say what should change: the design stage does that.

Done when each question is settled, or you know what the code does not show.

## 3. Write the recon file

Write `.bdk/runs/<change>/explore/propose-recon.md` (create the directories):

```markdown
---
question: Do the conditional AC of <change> hold in the code?
summary: <one line: per AC, holds / does not hold / open>
stage: propose
files: [<every project file you read for it>]
---
# Recon: <change>

## AC-3
> <the AC, quoted from the proposal>

- `test/world.ts:41` `seedGuest({ email })` takes no `expiresAt`; every guest it seeds expires in 7 days (`test/world.ts:44`).
- No other helper seeds a guest link (`grep -r "seedGuest\|createGuest" test/` finds only `test/world.ts`).

Settles: does not hold - no seed helper can create an expired link.
```

One section per AC, in order. Every bullet names `file:line` or a command. `Settles:` is `holds`, `does not hold`, or `open - <what the code does not show>`, then one line of why. No recommendation, no approach. Keep it under 60 lines. Change no other file.

Done when every named AC has its section and `Settles:` line.

## 4. Reply

Reply with the path of the file and one line per AC: its id and its `Settles:` line.
