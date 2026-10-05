---
name: diagnose
description: Analyzes one BDK session from its run journal, report and transcript slices into a cited analysis with a section safe for a BDK issue. Use when a run failed, looped or cost too much; for a broken install use /bdk:doctor.
argument-hint: "[session-id]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Read Grep
context: fork
agent: bdk:reader
disable-model-invocation: true
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill diagnose 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: diagnose" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill diagnose` first and apply its output; on a `BDK STOP` line, stop and report it.

# Diagnose

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context.

Explain what went wrong in one BDK session, why, and where each fix belongs, with a citation for every claim. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Done when `bdk diagnostics write` has stored the analysis and its path and top three problems are shown.

The session is `$ARGUMENTS` when it is given; pass it as `--session <session-id>` to every `bdk diagnostics` command. Without it, the kernel picks the latest session of the active Change, or the latest session.

You read the session only through the kernel. Never open a host transcript yourself: never `Read` or `Grep` the host's session files or any `.jsonl` file, because a transcript is large and holds the whole conversation. `bdk diagnostics slice` gives you the bounded part you need.

## 1. Read the report

Run `bdk diagnostics report --json`. On a refusal, show its `why` and `instead` and stop.

The report counts the session from the run journal and, when `transcript` is `ok`, from the host transcripts:

- `refusals` by rule and by role, `guardBlocks`, `retries`, `escalations`, `parks`, `questions`;
- `agents`, `tasks` and `parts` with tokens per model, and `cost` in USD for the whole session;
- `findings`: each has a `detector` (D1 to D8), the `agent`, the `ticket`, a `cite` and a one-line `summary`.

When `transcript` is not `ok`, the report says why (`missing`, `unreadable`, `unavailable`). Go on with the journal facts alone and say so in the summary. When `refusals.total`, `retries` and `findings` are all empty, report that the session shows no problem and stop.

## 2. Read around each problem

A problem is one finding, or one refusal rule with all its refusals. Take the problems in this order: findings by detector, then refusal rules by count.

For each problem, read at most one slice: `bdk diagnostics slice <cite> --json` with the `cite` of its finding. A refusal rule is cited by its D2 or D3 finding; a rule without a finding was refused too rarely to need a slice, so count it in the summary only. The slice shows the events of that agent around the cited point, each tool result cut to 20 lines, at most 200 lines. Widen it once with `--before` or `--after` (together at most 100 events) only when the cause is outside it.

When a finding or a slice names a ledger id (`L-` and eight characters), read it with `bdk log show <id> --json`. A retry or a park (D6) always names the ledger entry with its reason.

For each problem, write down:

- what happened, in one sentence, with its citation;
- why it happened: the instruction, contract, package or code that led to it, or the missing one;
- where the fix belongs, from [the fix locations](references/fix-locations.md).

Do not guess a cause the slice does not show. Write "cause not visible in the slice" and cite what you read.

## 3. Sort the problems

Sort the problems by cost: the tokens or the wall time they took, then how often they repeat. Merge problems with one cause into one.

A problem of the project (its tests, its plan, its code or its settings) is recorded for the next run when a Change is active: `bdk log add learning "<summary of at most 120 characters>" --ref <file, task or rule> --json`. A problem of BDK stays in the analysis only.

**Inside the BDK repository.** Read `.claude-plugin/plugin.json` of the working tree. When its `name` is `bdk`, this session ran BDK on itself, and every BDK problem in `## Where the fix belongs` also gives the file to change, the current sentence quoted from it, and the proposed sentence. Find the sentence with `Grep` in `skills/`, `agents/`, `pipeline/`, `rules/` or `kernel/src/`, and read the file around it before you quote it.

## 4. Write the analysis

Write the analysis in the five sections of [the analysis template](references/analysis-template.md): `## Summary`, `## What went well`, `## What went wrong`, `## Where the fix belongs` and `## For a BDK issue`. Every claim cites a journal line (`journal:<n>`), a transcript point (`<agent-id>:<line>`) or a ledger id.

The first four sections are local: they may quote project code and paths. `## For a BDK issue` is meant for a public issue, so it describes the BDK problems in words. In it, a code span is only a `bdk` command, a rule id, a ticket or ledger id, a role or adapter name, a settings key, a `/bdk:` skill, or a path under `.bdk/` or `${CLAUDE_PLUGIN_ROOT}`; it holds no fenced block and no line copied from a project file.

Store it with a quoted heredoc, so the shell changes nothing in it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" diagnostics write --json <<'ANALYSIS'
## Summary
...
ANALYSIS
```

On `policy/project-code`, the `why` names the line of `## For a BDK issue` and the check it failed. Rewrite that line in words, or move the detail to a section above, and write again. After the second refusal, stop and show the `why` to the user instead of trying a third time. On any other refusal, show its `why` and `instead` and stop.

## 5. Report

Show the path `bdk diagnostics write` printed and the top three problems, each with its cause and where its fix belongs. Then tell the user that the analysis is local and may hold project code, and that they should read `## For a BDK issue` before attaching it to an issue.
